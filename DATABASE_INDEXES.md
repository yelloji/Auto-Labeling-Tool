# Database Index Reference

## What is an Index?
An index is like a book's table of contents.
Without it → database reads every row to find what you want (slow).
With it → database jumps directly to matching rows (fast).

## Rule
- Never index every column — only columns used in WHERE / JOIN / filter queries
- Index costs a tiny bit of extra disk space and slightly slower writes (negligible)
- Huge benefit for read queries (which is 90% of app usage)

---

## Table: images

### Existing Indexes
| Index | Column | Note |
|---|---|---|
| sqlite_autoindex_images_1 | id (primary key) | Auto created |

### Added Indexes
| Index | Column | Why |
|---|---|---|
| ix_images_dataset_id | dataset_id | Every page load: "get all images for this dataset" |
| ix_images_split_type | split_type | Filter images by stage (unassigned/annotating/dataset) |
| ix_images_image_hash_md5 | image_hash_md5 | Duplicate check on every upload — scans all images |

---

## Table: annotations

### Existing Indexes
| Index | Column | Note |
|---|---|---|
| sqlite_autoindex_annotations_1 | id (primary key) | Auto created |

### Added Indexes
| Index | Column | Why |
|---|---|---|
| ix_annotations_image_id | image_id | Every image open: "get all annotations for this image" |

---

## Table: datasets

### Existing Indexes
| Index | Column | Note |
|---|---|---|
| sqlite_autoindex_datasets_1 | id (primary key) | Auto created |

### Added Indexes
| Index | Column | Why |
|---|---|---|
| ix_datasets_project_id | project_id | Every project open: "get all datasets for this project" |

---

## Tables Already Well Indexed
| Table | Indexes |
|---|---|
| ai_models | name + project_id (unique) |
| human_verifications | project_id+image_name, image_hash_md5, image_hash_perceptual |
| image_transformations | status, release_version, release_id |
| image_variants | parent_image_id |
| training_sessions | project_id+name, training_uid, project_id+status |

---

## How to Apply
Indexes are added in two places:
1. **Live database** — direct SQLite ALTER (instant, no data loss)
2. **models.py** — `index=True` on column definition (for fresh installs)

## Date Added
2026-03-18
