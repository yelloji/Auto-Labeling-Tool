"""Per-training analytics PDF report: dataset composition + per-image TP/FP/Doubt/Missing
counts and precision/recall/accuracy, built from human-verified SAHI Prediction experiments.

Report is stored as JSON "sections" (one section per experiment added) alongside a
regenerated report.pdf, so new experiments (e.g. a later val batch) can be appended
without losing earlier sections.
"""
import json
from pathlib import Path
from datetime import datetime

from sqlalchemy.orm import Session
from sqlalchemy import func

from database.models import ModelExperiment, TrainingSession, Release, Image as DBImage, HumanVerification
from core.config import settings

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

_STAT_COLORS = {"tp": "#3f8600", "fp": "#cf1322", "doubt": "#ad8b00", "missing": "#d4630a", "partial_missing": "#ad6800"}


def _parse_json(value, default):
    if not value:
        return default
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except Exception:
        return default


def _get_dataset_composition(training: TrainingSession, db: Session) -> dict:
    composition = {
        "release_name": None,
        "original_image_size": None,
        "original_images": {"train": 0, "val": 0, "test": 0},
        "tiles": {"train": 0, "val": 0, "test": 0},
        "tile_size": None,
        "tile_grid": None,
        "label_unlabeled_ratio": None,
    }
    if not training.dataset_release_id:
        return composition

    release = db.query(Release).filter(Release.id == training.dataset_release_id).first()
    if not release:
        return composition

    composition["release_name"] = release.name
    cfg = _parse_json(release.config, {})

    split_counts = cfg.get("split_counts") or {}
    composition["tiles"] = {
        "train": split_counts.get("train", release.train_image_count or 0),
        "val": split_counts.get("val", release.val_image_count or 0),
        "test": split_counts.get("test", release.test_image_count or 0),
    }

    for t in (cfg.get("transformations") or []):
        if t.get("type") == "resize":
            p = t.get("params", {})
            if p.get("width") and p.get("height"):
                composition["tile_size"] = f"{p.get('width')}x{p.get('height')}"
        if t.get("type") == "tile":
            p = t.get("params", {})
            if p.get("cols") and p.get("rows"):
                composition["tile_grid"] = f"{p.get('cols')}x{p.get('rows')}"

    tile_balance = cfg.get("tile_balance") or {}
    if "ratio_value" in tile_balance and tile_balance["ratio_value"] is not None:
        composition["label_unlabeled_ratio"] = f"1:{tile_balance['ratio_value']}"

    dataset_ids = cfg.get("dataset_ids") or []
    if dataset_ids:
        rows = (
            db.query(DBImage.split_section, func.count(DBImage.id))
            .filter(DBImage.dataset_id.in_(dataset_ids))
            .group_by(DBImage.split_section)
            .all()
        )
        for split_section, count in rows:
            key = (split_section or "").lower()
            if key in composition["original_images"]:
                composition["original_images"][key] = count

        one_image = (
            db.query(DBImage.width, DBImage.height)
            .filter(DBImage.dataset_id.in_(dataset_ids), DBImage.width.isnot(None), DBImage.height.isnot(None))
            .first()
        )
        if one_image and one_image[0] and one_image[1]:
            composition["original_image_size"] = f"{one_image[0]}x{one_image[1]}"

    return composition


def _metrics_from_totals(tp: int, fp_count: int, missing: int) -> dict:
    precision = (tp / (tp + fp_count)) if (tp + fp_count) else None
    recall = (tp / (tp + missing)) if (tp + missing) else None
    accuracy = (tp / (tp + fp_count + missing)) if (tp + fp_count + missing) else None
    return {"precision": precision, "recall": recall, "accuracy": accuracy}


def _both_metrics(totals: dict) -> tuple:
    """(excluding_doubt, including_doubt) metric dicts from a {tp, fp, doubt, missing} totals dict.
    Excluding doubt: doubtful detections are left out of the math entirely.
    Including doubt: doubtful detections are treated as false positives (the
    conservative reading — a detection that isn't confirmed correct counts as wrong)."""
    tp, fp, doubt, missing = totals["tp"], totals["fp"], totals["doubt"], totals["missing"]
    return _metrics_from_totals(tp, fp, missing), _metrics_from_totals(tp, fp + doubt, missing)


def _combined_totals_and_metrics(sections: list) -> dict:
    combined = {"tp": 0, "fp": 0, "doubt": 0, "missing": 0, "partial_missing": 0}
    for section in sections:
        for k in combined:
            combined[k] += section["totals"][k]
    metrics_excluding_doubt, metrics_including_doubt = _both_metrics(combined)
    return {
        "totals": combined,
        "metrics_excluding_doubt": metrics_excluding_doubt,
        "metrics_including_doubt": metrics_including_doubt,
    }


def _get_experiment_section(experiment: ModelExperiment, db: Session) -> dict:
    custom_params = _parse_json(experiment.custom_params, {})
    split = custom_params.get("split") or "unknown"

    rows = db.query(HumanVerification).filter(HumanVerification.experiment_id == experiment.id).all()

    per_image = {}
    for r in rows:
        entry = per_image.setdefault(r.image_name, {"image_name": r.image_name, "tp": 0, "fp": 0, "doubt": 0, "missing": 0, "partial_missing": 0})
        if r.status == "pass":
            entry["tp"] += 1
        elif r.status == "fail":
            entry["fp"] += 1
        elif r.status == "doubt":
            entry["doubt"] += 1
        elif r.status == "missing":
            entry["missing"] += 1
        elif r.status == "partial_missing":
            entry["partial_missing"] += 1

    per_image_list = sorted(per_image.values(), key=lambda x: x["image_name"])

    totals = {"tp": 0, "fp": 0, "doubt": 0, "missing": 0, "partial_missing": 0}
    for entry in per_image_list:
        for k in ("tp", "fp", "doubt", "missing", "partial_missing"):
            totals[k] += entry[k]

    metrics_excluding_doubt, metrics_including_doubt = _both_metrics(totals)

    return {
        "experiment_id": experiment.id,
        "experiment_name": experiment.name,
        "split": split,
        "image_count": experiment.image_count,
        "generated_at": datetime.utcnow().isoformat(),
        "per_image": per_image_list,
        "totals": totals,
        "metrics_excluding_doubt": metrics_excluding_doubt,
        "metrics_including_doubt": metrics_including_doubt,
    }


def get_report_status(training_id: int, db: Session) -> dict:
    """Whether this training has any report sections yet, for enabling/disabling the UI button."""
    training = db.query(TrainingSession).filter(TrainingSession.id == training_id).first()
    if not training or not training.run_dir:
        return {"has_report": False, "sections": []}

    sections_path = settings.BASE_DIR / training.run_dir / "report" / "report_sections.json"
    if not sections_path.exists():
        return {"has_report": False, "sections": []}

    sections = _parse_json(sections_path.read_text(encoding="utf-8"), [])
    return {
        "has_report": len(sections) > 0,
        "sections": [{"experiment_id": s["experiment_id"], "experiment_name": s["experiment_name"], "split": s["split"]} for s in sections],
    }


def get_report_data(training_id: int, db: Session) -> dict:
    """Full composition + all sections, for on-screen rendering (not just the PDF)."""
    training = db.query(TrainingSession).filter(TrainingSession.id == training_id).first()
    if not training:
        raise ValueError("Training session not found")

    composition = _get_dataset_composition(training, db)

    sections = []
    if training.run_dir:
        sections_path = settings.BASE_DIR / training.run_dir / "report" / "report_sections.json"
        if sections_path.exists():
            sections = _parse_json(sections_path.read_text(encoding="utf-8"), [])

    return {
        "training_name": training.name,
        "composition": composition,
        "sections": sections,
        "combined": _combined_totals_and_metrics(sections) if sections else None,
    }


def list_addable_experiments(training_id: int, db: Session) -> list:
    """Completed SAHI prediction experiments for this training that have human review data,
    for the 'Add Experiment' picker inside the report window."""
    experiments = (
        db.query(ModelExperiment)
        .filter(ModelExperiment.training_id == training_id, ModelExperiment.status == "completed")
        .order_by(ModelExperiment.created_at.desc())
        .all()
    )
    result = []
    for exp in experiments:
        if can_add_experiment(exp, db):
            custom_params = _parse_json(exp.custom_params, {})
            result.append({
                "experiment_id": exp.id,
                "experiment_name": exp.name,
                "split": custom_params.get("split") or "unknown",
                "image_count": exp.image_count,
            })
    return result


def can_add_experiment(experiment: ModelExperiment, db: Session) -> bool:
    """A run is only reportable once it has at least one human-reviewed detection."""
    if not experiment or experiment.status != "completed":
        return False
    count = db.query(HumanVerification).filter(HumanVerification.experiment_id == experiment.id).count()
    return count > 0


def _render_pdf(pdf_path: Path, training: TrainingSession, composition: dict, sections: list):
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("ReportTitle", parent=styles["Title"], fontSize=18)
    h2 = ParagraphStyle("ReportH2", parent=styles["Heading2"], spaceBefore=14, spaceAfter=4)
    normal = styles["Normal"]
    stat_label_style = ParagraphStyle("StatLabel", parent=normal, fontSize=8, textColor=colors.HexColor("#666666"), alignment=1)
    stat_value_style = ParagraphStyle("StatValue", parent=normal, fontSize=20, fontName="Helvetica-Bold", alignment=1)
    metric_label_style = ParagraphStyle("MetricLabel", parent=normal, fontSize=9, textColor=colors.HexColor("#666666"))
    metric_value_style = ParagraphStyle("MetricValue", parent=normal, fontSize=16, fontName="Helvetica-Bold")

    def fmt(v):
        return f"{v * 100:.1f}%" if v is not None else "N/A"

    def stat_row(totals):
        """One row of big colored TP/FP/Doubt/Missing numbers, like the on-screen stat cards."""
        cells = []
        for key, label in (("tp", "True Positive"), ("fp", "False Positive"), ("doubt", "Doubt"), ("missing", "Missing"), ("partial_missing", "Partial Missing")):
            color = colors.HexColor(_STAT_COLORS[key])
            value_style = ParagraphStyle(f"StatValue_{key}", parent=stat_value_style, textColor=color)
            cells.append([Paragraph(label, stat_label_style), Paragraph(str(totals.get(key, 0)), value_style)])
        col_w = 84
        table = Table(
            [[c[0] for c in cells], [c[1] for c in cells]],
            colWidths=[col_w] * 5, hAlign="LEFT"
        )
        table.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#e0e0e0")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e0e0e0")),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#fafafa")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, 0), 6),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
            ("TOPPADDING", (0, 1), (-1, 1), 10),
            ("BOTTOMPADDING", (0, 1), (-1, 1), 14),
        ]))
        return table

    def metrics_block(m_ex, m_in):
        rows = [
            [Paragraph("", metric_label_style), Paragraph("Precision", metric_label_style), Paragraph("Recall", metric_label_style), Paragraph("Accuracy", metric_label_style)],
            [
                Paragraph("Excluding Doubt", metric_label_style),
                Paragraph(fmt(m_ex["precision"]), metric_value_style),
                Paragraph(fmt(m_ex["recall"]), metric_value_style),
                Paragraph(fmt(m_ex["accuracy"]), metric_value_style),
            ],
            [
                Paragraph("Including Doubt", metric_label_style),
                Paragraph(fmt(m_in["precision"]), metric_value_style),
                Paragraph(fmt(m_in["recall"]), metric_value_style),
                Paragraph(fmt(m_in["accuracy"]), metric_value_style),
            ],
        ]
        table = Table(rows, colWidths=[100, 106.67, 106.67, 106.67], hAlign="LEFT")
        table.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#e0e0e0")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e0e0e0")),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#fafafa")),
            ("ALIGN", (1, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        return table

    doc = SimpleDocTemplate(
        str(pdf_path), pagesize=A4,
        leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=20 * mm
    )

    def _draw_footer(canvas, doc_):
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(colors.HexColor("#999999"))
        canvas.drawString(18 * mm, 10 * mm, f"{training.name} — Model Evaluation Report")
        canvas.drawRightString(A4[0] - 18 * mm, 10 * mm, f"Page {doc_.page}")
        canvas.restoreState()

    story = [
        Paragraph("Model Evaluation Report", title_style),
        Paragraph(f"Training: {training.name}", normal),
        Paragraph(f"Dataset / Release: {composition.get('release_name') or '-'}", normal),
        Paragraph(f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}", normal),
    ]
    story.append(Spacer(1, 10))
    story.append(Paragraph("Dataset Composition", h2))

    comp_rows = [
        ["", "Train", "Val", "Test"],
        ["Original Images", composition["original_images"]["train"], composition["original_images"]["val"], composition["original_images"]["test"]],
        ["Tiles", composition["tiles"]["train"], composition["tiles"]["val"], composition["tiles"]["test"]],
    ]
    comp_table = Table(comp_rows, hAlign="LEFT")
    comp_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f2937")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (1, 0), (-1, -1), "CENTER"),
    ]))
    story.append(comp_table)
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        f"Each original photo ({composition.get('original_image_size') or 'unknown size'}) was split into "
        f"{composition.get('tile_grid') or 'an unrecorded grid of'} tiles, resized to "
        f"{composition.get('tile_size') or 'an unrecorded size'} for training, with a labeled-to-unlabeled "
        f"tile ratio of {composition.get('label_unlabeled_ratio') or 'unrecorded'}.",
        normal
    ))

    legend_rows = [[
        Paragraph('<font color="#3f8600"><b>TP</b></font> = correctly detected', normal),
        Paragraph('<font color="#cf1322"><b>FP</b></font> = false alarm, no crack there', normal),
    ], [
        Paragraph('<font color="#ad8b00"><b>Doubt</b></font> = unclear, maybe real or not', normal),
        Paragraph('<font color="#d4630a"><b>Missing</b></font> = real crack, model missed it entirely', normal),
    ], [
        Paragraph('<font color="#ad6800"><b>Partial Missing</b></font> = model found some of the crack, not all of it', normal),
        Paragraph('', normal),
    ]]
    legend_table = Table(legend_rows, colWidths=[220, 220], hAlign="LEFT")
    legend_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fafafa")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#e0e0e0")),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(Spacer(1, 10))
    story.append(legend_table)

    def make_divider():
        d = Table([[""]], colWidths=[440], rowHeights=[1])
        d.setStyle(TableStyle([("LINEBELOW", (0, 0), (-1, 0), 1, colors.HexColor("#d9d9d9"))]))
        return d

    for section in sections:
        story.append(Spacer(1, 22))
        story.append(make_divider())
        story.append(Spacer(1, 10))
        story.append(Paragraph(f"{str(section['split']).upper()} Set &mdash; Experiment: {section['experiment_name']}", h2))
        story.append(Paragraph(f"Images: {section['image_count']}", normal))
        story.append(Spacer(1, 10))
        story.append(stat_row(section["totals"]))
        story.append(Spacer(1, 10))
        story.append(metrics_block(section["metrics_excluding_doubt"], section["metrics_including_doubt"]))
        story.append(Spacer(1, 14))

        img_rows = [["Image", "TP", "FP", "Doubt", "Missing", "Partial Missing"]]
        for img in section["per_image"]:
            img_rows.append([img["image_name"], img["tp"], img["fp"], img["doubt"], img["missing"], img.get("partial_missing", 0)])
        totals = section["totals"]
        img_rows.append(["TOTAL", totals["tp"], totals["fp"], totals["doubt"], totals["missing"], totals.get("partial_missing", 0)])

        img_table = Table(img_rows, hAlign="LEFT", repeatRows=1)
        img_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f2937")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("ALIGN", (1, 0), (-1, -1), "CENTER"),
            ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#f3f4f6")),
            ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ]))
        story.append(img_table)

    if len(sections) > 1:
        combined = _combined_totals_and_metrics(sections)

        story.append(Spacer(1, 24))
        story.append(make_divider())
        story.append(Spacer(1, 10))
        story.append(Paragraph("Combined &mdash; All Sections", h2))
        story.append(Spacer(1, 10))
        story.append(stat_row(combined["totals"]))
        story.append(Spacer(1, 10))
        story.append(metrics_block(combined["metrics_excluding_doubt"], combined["metrics_including_doubt"]))

    doc.build(story, onFirstPage=_draw_footer, onLaterPages=_draw_footer)


def add_experiment_to_report(training_id: int, experiment_id: str, db: Session) -> Path:
    training = db.query(TrainingSession).filter(TrainingSession.id == training_id).first()
    if not training:
        raise ValueError("Training session not found")
    if not training.run_dir:
        raise ValueError("Training session has no run directory")

    experiment = db.query(ModelExperiment).filter(ModelExperiment.id == experiment_id).first()
    if not experiment:
        raise ValueError("Experiment not found")
    if not can_add_experiment(experiment, db):
        raise ValueError("Experiment has no reviewed (pass/fail/doubt/missing) detections yet")

    report_dir = settings.BASE_DIR / training.run_dir / "report"
    report_dir.mkdir(parents=True, exist_ok=True)
    sections_path = report_dir / "report_sections.json"

    sections = _parse_json(sections_path.read_text(encoding="utf-8"), []) if sections_path.exists() else []
    if not isinstance(sections, list):
        sections = []

    new_section = _get_experiment_section(experiment, db)
    # Re-adding the same experiment refreshes its section instead of duplicating it.
    sections = [s for s in sections if s.get("experiment_id") != experiment_id]
    sections.append(new_section)

    sections_path.write_text(json.dumps(sections, indent=2), encoding="utf-8")

    composition = _get_dataset_composition(training, db)
    pdf_path = report_dir / "report.pdf"
    _render_pdf(pdf_path, training, composition, sections)

    return pdf_path


def remove_experiment_from_report(training_id: int, experiment_id: str, db: Session) -> Path:
    training = db.query(TrainingSession).filter(TrainingSession.id == training_id).first()
    if not training:
        raise ValueError("Training session not found")
    if not training.run_dir:
        raise ValueError("Training session has no run directory")

    report_dir = settings.BASE_DIR / training.run_dir / "report"
    sections_path = report_dir / "report_sections.json"

    sections = _parse_json(sections_path.read_text(encoding="utf-8"), []) if sections_path.exists() else []
    if not isinstance(sections, list):
        sections = []

    sections = [s for s in sections if s.get("experiment_id") != experiment_id]
    sections_path.write_text(json.dumps(sections, indent=2), encoding="utf-8")

    composition = _get_dataset_composition(training, db)
    pdf_path = report_dir / "report.pdf"
    if sections:
        _render_pdf(pdf_path, training, composition, sections)
    elif pdf_path.exists():
        pdf_path.unlink()

    return pdf_path
