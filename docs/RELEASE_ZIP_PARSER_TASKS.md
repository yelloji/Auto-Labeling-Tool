# Release ZIP Parser – Task Checklist

* [x] Design & create `release_stats_worker.py` service
* [x] Trigger worker after ZIP generation in route `POST /releases/create`
* [x] Populate columns (`train_image_count`, `val_image_count`, `test_image_count`, `class_count`, `classes_json`)
* [ ] Implement `shapes_json` extraction (pending spec)
* [ ] Add periodic maintenance script to re-scan older releases
* [ ] Frontend enhancements to visualize statistics

---
Generated automatically by development task `doc_update`.