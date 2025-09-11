def generate_release(self, config: ReleaseConfig, release_version: str) -> str:
    """
    Generate a complete release with transformations and export
    
    Args:
        config: Release configuration
        release_version: Version identifier for transformations
        
    Returns:
        Release ID
    """
    release_id = None
    
    try:
        # Create release record
        release_id = self.create_release_record(config)
        
        # Initialize progress tracking
        self.update_release_progress(
            release_id,
            status="processing",
            current_step="loading_data",
            started_at=datetime.utcnow()
        )
        
        # Load pending transformations
        transformation_records = self.load_pending_transformations(release_version)
        if not transformation_records:
            raise ValueError(f"No pending transformations found for version {release_version}")
        
        # Get dataset images with split section filtering
        image_records = self.get_dataset_images(config.dataset_ids, config.split_sections)
        if not image_records:
            raise ValueError(f"No images found in datasets: {config.dataset_ids}")
        
        # Update progress
        self.update_release_progress(
            release_id,
            total_images=len(image_records),
            current_step="generating_configurations"
        )
        
        # Generate transformation configurations
        image_ids = [img["id"] for img in image_records]
        transformation_configs = generate_release_configurations(
            transformation_records,
            image_ids,
            config.images_per_original
        )
        
        # Update progress
        self.update_release_progress(
            release_id,
            current_step="processing_images"
        )
        
        # Initialize augmentation engine with project-specific path
        project = self.db.query(Project).filter(Project.id == config.project_id).first()
        project_name = project.name if project else f"project_{config.project_id}"
        output_dir = os.path.join("projects", project_name, "releases", release_id)
        self.augmentation_engine = create_augmentation_engine(output_dir)
        
        # Prepare image paths and dataset splits with multi-dataset support
        
        image_paths = []
        dataset_splits = {}
        dataset_sources = {}  # Track source dataset for each image

        # NEW: build annotations_map as we stage each image (authoritative approach)
        annotations_map: Dict[str, List[Union[BoundingBox, Polygon]]] = {}

        # Create staging directory for copied images
        staging_dir = f"{output_dir}/staging"
        os.makedirs(staging_dir, exist_ok=True)

        logger.info("operations.releases", f"🔄 COPYING IMAGES FROM MULTIPLE DATASETS:", "image_copying_start", {
            'dataset_count': len(set(img['dataset_name'] for img in image_records)),
            'total_images': len(image_records),
            'output_format': config.output_format
        })

        for img_record in image_records:
            # DB identity of the original image
            source_image_id = img_record["id"]

            # Get source image path
            source_path = self._resolve_image_path(img_record["file_path"])
            if not os.path.exists(source_path):
                logger.warning("errors.validation", f"Source image not found: {source_path}", "source_image_missing", {
                    'source_path': source_path,
                    'dataset_name': img_record['dataset_name'],
                    'filename': img_record['filename']
                })
                continue

            # Create unique filename to avoid conflicts between datasets
            dataset_name = img_record["dataset_name"]
            original_filename = img_record["filename"]  # e.g., "car.jpg"
            unique_filename = f"{dataset_name}_{original_filename}"

            # Copy / convert into staging
            try:
                if config.output_format.lower() == "original":
                    staging_path = os.path.join(staging_dir, unique_filename)
                    shutil.copy2(source_path, staging_path)
                    logger.info("operations.images", f"   Copied (original format): {source_path} → {staging_path}", "image_copied_original", {
                        'source_path': source_path,
                        'staging_path': staging_path,
                        'dataset_name': img_record['dataset_name']
                    })
                else:
                    base_name = Path(unique_filename).stem
                    extension = config.output_format.lower()
                    if extension == "jpeg":
                        extension = "jpg"
                    converted_filename = f"{base_name}.{extension}"
                    staging_path = os.path.join(staging_dir, converted_filename)

                    try:
                        original_image = Image.open(source_path)
                        self.augmentation_engine._save_image_with_format(
                            original_image,
                            staging_path,
                            config.output_format
                        )
                        logger.info("operations.images", f"   Copied and converted to {config.output_format}: {source_path} → {staging_path}", "image_converted", {
                            'source_path': source_path,
                            'staging_path': staging_path,
                            'output_format': config.output_format,
                            'dataset_name': img_record['dataset_name']
                        })
                    except Exception as format_error:
                        logger.warning("errors.validation", f"   Format conversion failed for {source_path}: {format_error}", "format_conversion_failed", {
                            'source_path': source_path,
                            'format_error': str(format_error),
                            'output_format': config.output_format,
                            'dataset_name': img_record['dataset_name']
                        })
                        logger.warning("operations.images", f"   Falling back to original format copy", "format_fallback", {
                            'source_path': source_path,
                            'dataset_name': img_record['dataset_name']
                        })
                        staging_path = os.path.join(staging_dir, unique_filename)
                        shutil.copy2(source_path, staging_path)

                # Register for processing
                image_paths.append(staging_path)
                dataset_splits[staging_path] = img_record["split_section"]
                dataset_sources[staging_path] = {
                    "dataset_name": dataset_name,
                    "dataset_id": img_record["dataset_id"],
                    "source_path": img_record["source_path"],
                    "original_filename": original_filename  # needed to derive stem if required
                }

                # >>> NEW (authoritative): fetch pixel annotations by DB id and map under both keys
                anns_px = _get_pixel_annotations_from_db(self.db, source_image_id)

                # map by the exact path we’ll send to the engine
                annotations_map[staging_path] = anns_px

                # also map by original filename stem (engine may compute id this way)
                # e.g., "car" from "car.jpg"
                original_stem = Path(original_filename).stem
                annotations_map[original_stem] = anns_px

                # optional: also map by the DB id as string
                annotations_map[str(source_image_id)] = anns_px

            except Exception as e:
                logger.error("errors.system", f"Failed to copy {source_path}: {e}", "image_copy_error", {
                    'source_path': source_path,
                    'error': str(e),
                    'dataset_name': img_record['dataset_name'],
                    'filename': img_record['filename']
                })
                continue

        
        # Log format conversion information
        if config.output_format.lower() == "original":
            logger.info("operations.images", f"✅ Successfully copied {len(image_paths)} images from {len(set(img['dataset_name'] for img in image_records))} datasets (preserving original formats)", "images_copied_success", {
                'image_count': len(image_paths),
                'dataset_count': len(set(img['dataset_name'] for img in image_records)),
                'output_format': 'original'
            })
        else:
            logger.info("operations.images", f"✅ Successfully copied and converted {len(image_paths)} images to {config.output_format.upper()} format from {len(set(img['dataset_name'] for img in image_records))} datasets", "images_converted_success", {
                'image_count': len(image_paths),
                'dataset_count': len(set(img['dataset_name'] for img in image_records)),
                'output_format': config.output_format.upper()
            })
        
        # Process all images with multi-dataset support
        all_results = process_release_images(
            image_paths=image_paths,
            transformation_configs=transformation_configs,
            dataset_splits=dataset_splits,
            output_dir=output_dir,
            output_format=config.output_format,
            dataset_sources=dataset_sources,              # Pass dataset source information
            annotations_map=annotations_map               # >>> NEW (labels travel with the same affine)
        )
        
        # Count generated images
        total_generated = sum(len(results) for results in all_results.values())
        
        # Update progress
        self.update_release_progress(
            release_id,
            processed_images=len(image_paths),
            generated_images=total_generated,
            current_step="finalizing"
        )
        
        # Update release record with results
        release = self.db.query(Release).filter(Release.id == release_id).first()
        if release:
            # Persist overall image statistics
            release.total_original_images = len(image_paths)
            release.total_augmented_images = total_generated
            release.final_image_count = total_generated + (len(image_paths) if config.include_original else 0)
            release.model_path = PathManager().get_project_relative_path(output_dir)

            # NEW: Compute and store accurate train/val/test split counts
            _orig_total, split_counts = self._calculate_split_counts(config.dataset_ids)
            release.train_image_count = split_counts.get("train", 0)
            release.val_image_count = split_counts.get("val", 0)
            release.test_image_count = split_counts.get("test", 0)

            self.db.commit()
        
        # Mark transformations as completed
        transformation_ids = [t["id"] for t in transformation_records]
        self.mark_transformations_completed(transformation_ids, release_id)
        
        # Intelligently select export format based on task type and annotations
        optimal_export_format = self._select_optimal_export_format(
            all_results, 
            config.export_format, 
            config.task_type if hasattr(config, 'task_type') else 'object_detection'
        )
        
        # Generate export files with transformed annotations
        export_path = self._generate_export_files(
            release_id, 
            all_results, 
            optimal_export_format,
            config.task_type if hasattr(config, 'task_type') else 'object_detection'
        )
        
        # Update progress
        self.update_release_progress(
            release_id,
            current_step="creating_zip_package",
            progress_percentage=90.0
        )
        
        # Create comprehensive ZIP package with organized structure
        try:
            # Update config with optimal export format
            config.export_format = optimal_export_format
            
            # Create ZIP package
            zip_path = self.create_zip_package(
                release_id,
                all_results,
                config,
                transformation_records
            )
            
            # Update release with ZIP path
            if release and zip_path:
                relative_zip_path = PathManager().get_project_relative_path(zip_path)
                release.model_path = relative_zip_path
                release.export_format = optimal_export_format
                release.task_type = config.task_type if hasattr(config, 'task_type') else 'object_detection'
                self.db.commit()
                logger.info("operations.releases", f"✅ ZIP package created successfully: {zip_path}", "zip_created_success", {
                    'zip_path': zip_path,
                    'release_id': release_id,
                    'file_size': os.path.getsize(zip_path) if os.path.exists(zip_path) else 0
                })
        except Exception as e:
            logger.error("errors.system", f"Failed to create ZIP package: {str(e)}", "zip_creation_error", {
                'error': str(e),
                'release_id': release_id,
                'zip_path': zip_path
            })
            # Fall back to regular export path if ZIP creation fails
            if release and export_path:
                release.model_path = PathManager().get_project_relative_path(export_path)
                release.export_format = optimal_export_format
                release.task_type = config.task_type if hasattr(config, 'task_type') else 'object_detection'
                self.db.commit()
        
        # Cleanup staging directory (images were copied, not moved)
        self._cleanup_staging_directory(staging_dir)
        
        # Update final progress
        self.update_release_progress(
            release_id,
            status="completed",
            progress_percentage=100.0,
            current_step="completed",
            completed_at=datetime.utcnow()
        )
        
        # Log multi-dataset statistics
        dataset_counts = {}
        for img_record in image_records:
            dataset_name = img_record["dataset_name"]
            dataset_counts[dataset_name] = dataset_counts.get(dataset_name, 0) + 1
        
        logger.info("operations.releases", f"✅ MULTI-DATASET RELEASE GENERATION COMPLETED: {release_id}", "release_generation_complete", {
            'release_id': release_id,
            'dataset_counts': dataset_counts,
            'total_original_images': len(image_paths),
            'total_generated_images': total_generated,
            'image_format': config.output_format.upper() if config.output_format.lower() != 'original' else 'Original (preserved)',
            'export_path': export_path
        })
        
        return release_id
        
    except Exception as e:
        error_msg = f"Failed to generate release: {str(e)}"
        logger.error("errors.system", error_msg, "release_generation_error", {
            'error': str(e),
            'release_id': release_id
        })
        
        if release_id:
            self.update_release_progress(
                release_id,
                status="failed",
                error_message=error_msg,
                completed_at=datetime.utcnow()
            )
        
        raise
