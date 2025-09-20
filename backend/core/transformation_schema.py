"""
Transformation Schema System for Auto-Labeling Tool Release Pipeline
Handles transformation tool combinations and sampling strategies
"""

import itertools
import random
import logging
import sys
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
import json

# Import dual-value transformation functions
from core.transformation_config import (
    is_dual_value_transformation, 
    generate_auto_value,
    DUAL_VALUE_TRANSFORMATIONS
)

# Import professional logging system - CORRECT PATTERN
from logging_system.professional_logger import get_professional_logger

# Initialize professional logger
logger = get_professional_logger()

@dataclass
class TransformationConfig:
    """Configuration for a single transformation"""
    tool_type: str
    parameters: Dict[str, Any]
    enabled: bool = True
    order_index: int = 0

@dataclass
class SamplingConfig:
    """Configuration for sampling strategy"""
    images_per_original: int = 4
    strategy: str = "intelligent"  # intelligent, random, uniform
    fixed_combinations: int = 2  # Always include first N combinations
    random_seed: Optional[int] = None

class TransformationSchema:
    """
    Manages transformation combinations and sampling for release generation
    Phase 1: Single-value transformations (current system)
    """
    
    def __init__(self):
        self.transformations: List[TransformationConfig] = []
        self.sampling_config = SamplingConfig()
        logger.info("operations.transformations", "TransformationSchema initialized", "schema_initialization", {
            'transformations_count': 0,
            'sampling_config': str(self.sampling_config)
        })
        
    def add_transformation(self, tool_type: str, parameters: Dict[str, Any], 
                          enabled: bool = True, order_index: int = 0) -> None:
        """Add a transformation to the schema"""
        config = TransformationConfig(
            tool_type=tool_type,
            parameters=parameters,
            enabled=enabled,
            order_index=order_index
        )
        self.transformations.append(config)
        logger.info("operations.transformations", f"Added transformation: {tool_type} with parameters: {parameters}", "transformation_added", {
            'tool_type': tool_type,
            'parameters': parameters,
            'enabled': enabled,
            'order_index': order_index,
            'total_transformations': len(self.transformations)
        })
    
    def load_from_database_records(self, db_transformations: List[Dict]) -> None:
        """Load transformations from database records"""
        logger.info("operations.transformations", f"Loading transformations from database records", "database_load_start", {
            'db_records_count': len(db_transformations)
        })
        
        self.transformations.clear()
        
        for record in db_transformations:
            if record.get('is_enabled', True):
                # Handle both JSON string and dict parameters
                parameters = record['parameters']
                if isinstance(parameters, str):
                    try:
                        parameters = json.loads(parameters)
                    except json.JSONDecodeError:
                        logger.error("errors.validation", f"Failed to parse parameters for {record['transformation_type']}", "parameter_parse_error", {
                            'transformation_type': record['transformation_type'],
                            'parameters': record['parameters']
                        })
                        continue
                
                self.add_transformation(
                    tool_type=record['transformation_type'],
                    parameters=parameters,
                    enabled=record.get('is_enabled', True),
                    order_index=record.get('order_index', 0)
                )
        
        # Sort by order_index
        self.transformations.sort(key=lambda x: x.order_index)
        logger.info("operations.transformations", f"Loaded {len(self.transformations)} transformations from database", "transformations_loaded", {
            'transformation_count': len(self.transformations),
            'enabled_count': len([t for t in self.transformations if t.enabled])
        })
        
        # Calculate and log combination count
        combination_count = self.get_combination_count_estimate()
        logger.info("operations.transformations", f"Maximum possible combinations: {combination_count}", "combination_count_calculated", {
            'combination_count': combination_count
        })
    
    def generate_single_value_combinations(self) -> List[Dict[str, Any]]:
        """
        Generate combinations using Priority structure for single-value transformations
        
        Priority Order:
        1st: Individual transformations (each tool applied separately)
        2nd: No auto-generated values (single-value tools don't have opposites)
        3rd: Tool combinations (2+ tools together)
        """
        if not self.transformations:
            logger.warning("operations.transformations", "No transformations available for single-value combination generation", "no_transformations_single_value", {
                'operation': 'generate_single_value_combinations'
            })
            return [{}]
        
        # Get enabled transformations only
        enabled_transformations = [t for t in self.transformations if t.enabled]
        
        if not enabled_transformations:
            logger.warning("operations.transformations", "No enabled transformations found", "no_enabled_transformations_single", {
                'total_transformations': len(self.transformations),
                'enabled_count': len(enabled_transformations)
            })
            return [{}]
        
        combinations = []
        
        # Separate resize from other transformations (resize is baseline, skip from combinations)
        regular_transformations = []
        for transformation in enabled_transformations:
            if transformation.tool_type == 'resize':
                logger.info("operations.transformations", f"⏭️ Skipping resize from combination generation (baseline transformation)", "skip_resize_baseline", {
                    'tool_type': transformation.tool_type
                })
                continue
            else:
                regular_transformations.append(transformation)
        
        # PRIORITY 1: Individual tools applied to original image
        logger.info("operations.transformations", "Generating Priority 1 combinations (individual tools)", "priority1_generation_start", {
            'tool_count': len(regular_transformations)
        })
        
        for transformation in regular_transformations:
            individual_combination = {
                transformation.tool_type: transformation.parameters.copy()
            }
            combinations.append(individual_combination)
            logger.info("operations.transformations", f"✅ PRIORITY 1 - Added individual tool: {transformation.tool_type}", "priority1_added", {
                'tool_type': transformation.tool_type,
                'parameters': transformation.parameters,
                'combination': individual_combination
            })
        
        # PRIORITY 2: No auto-generated values for single-value tools
        # (Single-value tools don't have opposite values like dual-value tools)
        logger.info("operations.transformations", "Priority 2: Skipped (no auto values for single-value tools)", "priority2_skipped", {
            'reason': 'single_value_tools_no_auto_values'
        })
        
        # PRIORITY 3: Tool combinations (2+ tools together)
        logger.info("operations.transformations", "Generating Priority 3 combinations (tool combinations)", "priority3_generation_start", {
            'tool_count': len(regular_transformations)
        })
        
        # Generate all combinations of 2 or more tools
        from itertools import combinations as iter_combinations
        
        for r in range(2, len(regular_transformations) + 1):  # 2, 3, 4, ... tools
            for tool_combo in iter_combinations(regular_transformations, r):
                combination = {}
                tool_names = []
                
                for transformation in tool_combo:
                    combination[transformation.tool_type] = transformation.parameters.copy()
                    tool_names.append(transformation.tool_type)
                
                combinations.append(combination)
                logger.info("operations.transformations", f"✅ PRIORITY 3 - Added tool combination: {'+'.join(tool_names)}", "priority3_added", {
                    'tools': tool_names,
                    'combination_size': len(tool_combo),
                    'combination': combination
                })
        
        logger.info("operations.transformations", f"Generated {len(combinations)} single-value combinations using Priority structure", "single_value_combinations_generated", {
            'combination_count': len(combinations),
            'regular_transformations': len(regular_transformations),
            'priority1_count': len(regular_transformations),
            'priority2_count': 0,
            'priority3_count': len(combinations) - len(regular_transformations)
        })
        return combinations
    
    def generate_dual_value_combinations(self) -> List[Dict[str, Any]]:
        """
        Generate combinations using dual-value priority order system
        
        Priority Order:
        1st: User Selected Values (individual transformations)
        2nd: Auto-Generated Values (opposite values)
        3rd: Random Combinations (fill remaining slots)
        """
        if not self.transformations:
            logger.warning("operations.transformations", "No transformations available for dual-value combination generation", "no_transformations_dual_value", {
                'operation': 'generate_dual_value_combinations'
            })
            return [{}]
        
        # Get enabled transformations only
        enabled_transformations = [t for t in self.transformations if t.enabled]
        
        if not enabled_transformations:
            logger.warning("operations.transformations", "No enabled transformations found", "no_enabled_transformations_dual", {
                'total_transformations': len(self.transformations),
                'enabled_count': len(enabled_transformations)
            })
            return [{}]
        
        combinations = []
        
        # Separate dual-value and regular transformations
        dual_value_transformations = []
        regular_transformations = []
        
        logger.info("operations.transformations", f"🔍 DEBUG - Input transformations:", "debug_input_transformations", {
            'enabled_count': len(enabled_transformations)
        })
        for t in enabled_transformations:
            logger.info("operations.transformations", f"  Tool: {t.tool_type}, Params: {t.parameters}, Dual-value: {is_dual_value_transformation(t.tool_type)}", "debug_transformation_details", {
                'tool_type': t.tool_type,
                'is_dual_value': is_dual_value_transformation(t.tool_type)
            })
        
        for transformation in enabled_transformations:
            # Skip resize as it's a baseline transformation applied to all images
            if transformation.tool_type == 'resize':
                logger.info("operations.transformations", f"⏭️ Skipping resize from combination generation (baseline transformation)", "skip_resize_baseline", {
                    'tool_type': transformation.tool_type
                })
                continue
            elif is_dual_value_transformation(transformation.tool_type):
                dual_value_transformations.append(transformation)
            else:
                regular_transformations.append(transformation)
        
        # PRIORITY 1: User Selected Values (individual transformations)
        logger.info("operations.transformations", "Generating Priority 1: User Selected Values", "priority1_start", {
            'dual_value_count': len(dual_value_transformations)
        })
        for transformation in dual_value_transformations:
            # Extract user value from parameters
            user_params = transformation.parameters.copy()
            
            # Handle dual-value parameter format
            if isinstance(transformation.parameters, dict):
                # Check if it's already in dual-value format
                for param_name, param_value in transformation.parameters.items():
                    if isinstance(param_value, dict) and 'user_value' in param_value:
                        user_params[param_name] = param_value['user_value']
            
            combination = {transformation.tool_type: user_params}
            combinations.append(combination)
            logger.info("operations.transformations", f"✅ PRIORITY 1 - Added user value combination: {combination}", "priority1_user_combination", {
                'tool_type': transformation.tool_type,
                'combination': combination
            })
        
        # Add single-value transformations to Priority 1 as well
        logger.info("operations.transformations", "Adding single-value transformations to Priority 1", "priority1_single_value_start", {
            'regular_count': len(regular_transformations)
        })
        for transformation in regular_transformations:
            combination = {transformation.tool_type: transformation.parameters.copy()}
            combinations.append(combination)
            logger.info("operations.transformations", f"✅ PRIORITY 1 - Added single-value combination: {combination}", "priority1_single_combination", {
                'tool_type': transformation.tool_type,
                'combination': combination
            })
        
        # PRIORITY 2: Auto-Generated Values (opposite values)
        logger.info("operations.transformations", "Generating Priority 2: Auto-Generated Values", "priority2_start", {
            'dual_value_count': len(dual_value_transformations)
        })
        for transformation in dual_value_transformations:
            auto_params = {}
            
            # Generate auto values for each parameter
            for param_name, param_value in transformation.parameters.items():
                if isinstance(param_value, dict) and 'user_value' in param_value:
                    # Already in dual-value format
                    user_value = param_value['user_value']
                    if isinstance(user_value, (int, float)):
                        auto_value = generate_auto_value(transformation.tool_type, user_value)
                        auto_params[param_name] = auto_value
                    else:
                        # Non-numeric parameter, keep original value
                        auto_params[param_name] = user_value
                else:
                    # Single value - generate auto value only for numeric parameters
                    if isinstance(param_value, (int, float)):
                        auto_value = generate_auto_value(transformation.tool_type, param_value)
                        auto_params[param_name] = auto_value
                    else:
                        # Non-numeric parameter, keep original value
                        auto_params[param_name] = param_value
            
            combination = {transformation.tool_type: auto_params}
            combinations.append(combination)
            logger.info("operations.transformations", f"🔄 PRIORITY 2 - Added auto value combination: {combination}", "priority2_auto_combination", {
                'tool_type': transformation.tool_type,
                'combination': combination
            })
        
        # PRIORITY 3: Random Combinations (if more images needed)
        logger.info("operations.transformations", f"Generating Priority 3: Random Combinations (current: {len(combinations)}, target: {self.sampling_config.images_per_original})", "priority3_start", {
            'current_combinations': len(combinations),
            'target_images': self.sampling_config.images_per_original
        })
        remaining_slots = self.sampling_config.images_per_original - len(combinations)
        if remaining_slots > 0:
            
            # Generate combinations of both user and auto values
            all_values = []
            
            # Collect all user and auto values
            for transformation in dual_value_transformations:
                user_params = transformation.parameters.copy()
                auto_params = {}
                
                for param_name, param_value in transformation.parameters.items():
                    if isinstance(param_value, dict) and 'user_value' in param_value:
                        user_params[param_name] = param_value['user_value']
                        user_value = param_value['user_value']
                        if isinstance(user_value, (int, float)):
                            auto_params[param_name] = param_value.get('auto_value', 
                                                                   generate_auto_value(transformation.tool_type, user_value))
                        else:
                            # Non-numeric parameter, keep original value
                            auto_params[param_name] = user_value
                    else:
                        if isinstance(param_value, (int, float)):
                            auto_params[param_name] = generate_auto_value(transformation.tool_type, param_value)
                        else:
                            # Non-numeric parameter, keep original value
                            auto_params[param_name] = param_value
                
                all_values.append((transformation.tool_type, user_params, auto_params))
            
            # Generate combinations
            additional_combinations = []
            
            # Both user values combination
            if len(dual_value_transformations) >= 2:
                both_user_combo = {}
                for tool_type, user_params, _ in all_values:
                    both_user_combo[tool_type] = user_params
                additional_combinations.append(both_user_combo)
            
            # Both auto values combination
            if len(dual_value_transformations) >= 2:
                both_auto_combo = {}
                for tool_type, _, auto_params in all_values:
                    both_auto_combo[tool_type] = auto_params
                additional_combinations.append(both_auto_combo)
            
            # Mixed combinations (user + auto)
            if len(dual_value_transformations) >= 2:
                for i, (tool_type1, user_params1, auto_params1) in enumerate(all_values):
                    for j, (tool_type2, user_params2, auto_params2) in enumerate(all_values):
                        if i != j:
                            mixed_combo = {
                                tool_type1: user_params1,
                                tool_type2: auto_params2
                            }
                            additional_combinations.append(mixed_combo)
            
            # ✅ NEW: Generate combinations with single-value tools
            if len(dual_value_transformations) >= 1 and len(regular_transformations) >= 1:
                logger.info("operations.transformations", "Generating dual-value + single-value combinations", "dual_single_combinations_start", {
                'remaining_slots': remaining_slots
            })
                for dual_transformation in dual_value_transformations:
                    # Get user and auto values for dual-value tool
                    dual_user_params = {}
                    dual_auto_params = {}
                    
                    for param_name, param_value in dual_transformation.parameters.items():
                        if isinstance(param_value, dict) and 'user_value' in param_value:
                            dual_user_params[param_name] = param_value['user_value']
                            user_value = param_value['user_value']
                            if isinstance(user_value, (int, float)):
                                dual_auto_params[param_name] = param_value.get('auto_value', 
                                                             generate_auto_value(dual_transformation.tool_type, user_value))
                            else:
                                # Non-numeric parameter, keep original value
                                dual_auto_params[param_name] = user_value
                        else:
                            # For simple values like {"percentage": 50}, use as user value and generate auto
                            dual_user_params[param_name] = param_value
                            if isinstance(param_value, (int, float)):
                                dual_auto_params[param_name] = generate_auto_value(dual_transformation.tool_type, param_value)
                            else:
                                # Non-numeric parameter, keep original value
                                dual_auto_params[param_name] = param_value
                    
                    # Combine with each single-value tool
                    for single_transformation in regular_transformations:
                        # Dual-value (user) + Single-value combination
                        combo1 = {
                            dual_transformation.tool_type: dual_user_params,
                            single_transformation.tool_type: single_transformation.parameters.copy()
                        }
                        additional_combinations.append(combo1)
                        logger.info("operations.transformations", f"🎲 PRIORITY 3 - Added dual(user)+single combination: {combo1}", "priority3_dual_user_single", {
                            'dual_tool': dual_transformation.tool_type,
                            'single_tool': single_transformation.tool_type,
                            'combination': combo1
                        })
                        
                        # Dual-value (auto) + Single-value combination  
                        combo2 = {
                            dual_transformation.tool_type: dual_auto_params,
                            single_transformation.tool_type: single_transformation.parameters.copy()
                        }
                        additional_combinations.append(combo2)
                        logger.info("operations.transformations", f"🎲 PRIORITY 3 - Added dual(auto)+single combination: {combo2}", "priority3_dual_auto_single", {
                            'dual_tool': dual_transformation.tool_type,
                            'single_tool': single_transformation.tool_type,
                            'combination': combo2
                        })
            
            # Add random combinations up to the limit
            random.shuffle(additional_combinations)
            combinations.extend(additional_combinations[:remaining_slots])
        
        logger.info("operations.transformations", f"🎉 FINAL RESULT - Generated {len(combinations)} transformation combinations:", "final_combinations_result", {
            'total_combinations': len(combinations)
        })
        for i, combo in enumerate(combinations):
            logger.info("operations.transformations", f"  {i+1}. {combo}", "combination_detail", {
                'combination_index': i+1,
                'combination': combo
            })
        return combinations
    
    def apply_intelligent_sampling(self, combinations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Apply intelligent sampling to reduce combination count
        """
        if len(combinations) <= self.sampling_config.images_per_original:
            return combinations
        
        # Set random seed for reproducible results
        if self.sampling_config.random_seed:
            random.seed(self.sampling_config.random_seed)
        
        sampled = []
        
        # Always include fixed combinations (first N)
        fixed_count = min(self.sampling_config.fixed_combinations, len(combinations))
        sampled.extend(combinations[:fixed_count])
        
        # Randomly sample remaining combinations
        remaining_combinations = combinations[fixed_count:]
        remaining_needed = self.sampling_config.images_per_original - fixed_count
        
        if remaining_needed > 0 and remaining_combinations:
            additional_samples = random.sample(
                remaining_combinations, 
                min(remaining_needed, len(remaining_combinations))
            )
            sampled.extend(additional_samples)
        
        logger.info("operations.transformations", f"Sampled {len(sampled)} combinations from {len(combinations)} total", "combinations_sampled", {
            'sampled_count': len(sampled),
            'total_combinations': len(combinations),
            'fixed_count': fixed_count,
            'remaining_needed': remaining_needed
        })
        return sampled
    
    def generate_transformation_configs_for_image(self, image_id: str) -> List[Dict[str, Any]]:
        """
        Generate transformation configurations for a single image
        Returns list of configs to apply to the image
        """
        logger.info("operations.transformations", f"Generating transformation configs for image {image_id}", "config_generation_start", {
            'image_id': image_id,
            'transformations_count': len(self.transformations)
        })
        
        # Check if we have dual-value transformations
        has_dual_value_transformations = any(
            is_dual_value_transformation(t.tool_type) 
            for t in self.transformations if t.enabled
        )
        
        # Generate combinations based on system type
        if has_dual_value_transformations:
            logger.info("operations.transformations", f"Using dual-value combination generation for image {image_id}", "dual_value_generation_selected", {
            'image_id': image_id,
            'generation_type': 'dual_value'
        })
            all_combinations = self.generate_dual_value_combinations()
        else:
            logger.info("operations.transformations", f"Using single-value combination generation for image {image_id}", "single_value_generation_selected", {
            'image_id': image_id,
            'generation_type': 'single_value'
        })
            all_combinations = self.generate_single_value_combinations()
        
        # Apply sampling strategy
        if self.sampling_config.strategy == "intelligent":
            sampled_combinations = self.apply_intelligent_sampling(all_combinations)
        elif self.sampling_config.strategy == "random":
            sampled_combinations = random.sample(
                all_combinations, 
                min(self.sampling_config.images_per_original, len(all_combinations))
            )
        elif self.sampling_config.strategy == "uniform":
            # Take evenly spaced combinations
            step = max(1, len(all_combinations) // self.sampling_config.images_per_original)
            sampled_combinations = all_combinations[::step][:self.sampling_config.images_per_original]
        else:
            # Default to intelligent
            sampled_combinations = self.apply_intelligent_sampling(all_combinations)
        
        # Add metadata to each configuration
        configs_with_metadata = []
        for i, config in enumerate(sampled_combinations):
            config_with_metadata = {
                "config_id": f"{image_id}_config_{i+1}",
                "image_id": image_id,
                "transformations": config,
                "order": i + 1,
                "priority_type": self._get_priority_type(config, i) if has_dual_value_transformations else "single_value"
            }
            configs_with_metadata.append(config_with_metadata)
        
        logger.info("operations.transformations", f"Generated {len(configs_with_metadata)} transformation configs for image {image_id}", "configs_generated", {
            'image_id': image_id,
            'config_count': len(configs_with_metadata),
            'sampling_strategy': self.sampling_config.strategy
        })
        return configs_with_metadata
    
    def _get_priority_type(self, config: Dict[str, Any], order: int) -> str:
        """Determine the priority type of a configuration"""
        dual_value_count = sum(1 for tool_type in config.keys() if is_dual_value_transformation(tool_type))
        
        if dual_value_count == 1:
            # Single transformation - could be user or auto value
            if order < dual_value_count:
                return "user_value"
            else:
                return "auto_value"
        elif dual_value_count > 1:
            return "combination"
        else:
            return "regular"
    
    def set_sampling_config(self, images_per_original: int = 4, strategy: str = "intelligent", 
                           fixed_combinations: int = 2, random_seed: Optional[int] = None) -> None:
        """Update sampling configuration"""
        self.sampling_config = SamplingConfig(
            images_per_original=images_per_original,
            strategy=strategy,
            fixed_combinations=fixed_combinations,
            random_seed=random_seed
        )
        logger.info("operations.transformations", f"Updated sampling config: {self.sampling_config}", "sampling_config_updated", {
            'sampling_config': str(self.sampling_config),
            'images_per_original': images_per_original,
            'strategy': strategy,
            'fixed_combinations': fixed_combinations,
            'random_seed': random_seed
        })
    
    def get_combination_count_estimate(self) -> int:
        """Estimate total images per original INCLUDING the original
        
        ✅ Uses centralized calculation function for consistency
        """
        # Convert to format expected by centralized function
        transformation_list = []
        for t in self.transformations:
            transformation_list.append({
                'transformation_type': t.tool_type,
                'enabled': t.enabled,
                'parameters': t.parameters
            })
        
        # Use centralized calculation from transformation_config
        from core.transformation_config import calculate_max_images_per_original
        result = calculate_max_images_per_original(transformation_list)
        
        logger.info("operations.transformations", f"Calculated combination count estimate", "combination_count_estimate", {
            'transformation_count': len(transformation_list),
            'enabled_count': len([t for t in transformation_list if t['enabled']]),
            'max_images': result.get('max', 1)
        })
        
        return result.get('max', 1)
    
    def validate_configuration(self) -> Tuple[bool, List[str]]:
        """
        Validate the current schema configuration
        Returns (is_valid, list_of_errors)
        """
        logger.info("operations.transformations", "Validating schema configuration", "validation_start", {
            'transformations_count': len(self.transformations),
            'sampling_config': str(self.sampling_config)
        })
        
        errors = []
        
        if not self.transformations:
            errors.append("No transformations defined")
        
        enabled_transformations = [t for t in self.transformations if t.enabled]
        if not enabled_transformations:
            errors.append("No enabled transformations found")
        
        if self.sampling_config.images_per_original <= 0:
            errors.append("images_per_original must be greater than 0")
        
        if self.sampling_config.fixed_combinations < 0:
            errors.append("fixed_combinations cannot be negative")
        
        if self.sampling_config.fixed_combinations > self.sampling_config.images_per_original:
            errors.append("fixed_combinations cannot exceed images_per_original")
        
        # Validate individual transformation parameters
        for transformation in self.transformations:
            if not transformation.tool_type:
                errors.append(f"Transformation missing tool_type")
            
            if not isinstance(transformation.parameters, dict):
                errors.append(f"Invalid parameters for {transformation.tool_type}")
        
        is_valid = len(errors) == 0
        
        if is_valid:
            logger.info("operations.transformations", "Schema configuration validation passed", "validation_success", {
                'transformations_count': len(self.transformations),
                'enabled_count': len(enabled_transformations)
            })
        else:
            logger.error("errors.validation", f"Schema configuration validation failed: {errors}", "validation_failed", {
                'errors': errors,
                'transformations_count': len(self.transformations)
            })
        
        return is_valid, errors
    
    def to_dict(self) -> Dict[str, Any]:
        """Export schema configuration to dictionary"""
        logger.info("operations.transformations", "Exporting schema configuration to dictionary", "schema_export", {
            'transformations_count': len(self.transformations)
        })
        
        return {
            "transformations": [
                {
                    "tool_type": t.tool_type,
                    "parameters": t.parameters,
                    "enabled": t.enabled,
                    "order_index": t.order_index
                }
                for t in self.transformations
            ],
            "sampling_config": {
                "images_per_original": self.sampling_config.images_per_original,
                "strategy": self.sampling_config.strategy,
                "fixed_combinations": self.sampling_config.fixed_combinations,
                "random_seed": self.sampling_config.random_seed
            }
        }
    
    def from_dict(self, data: Dict[str, Any]) -> None:
        """Load schema configuration from dictionary"""
        logger.info("operations.transformations", "Loading schema configuration from dictionary", "schema_import", {
            'data_keys': list(data.keys())
        })
        
        self.transformations.clear()
        
        for t_data in data.get("transformations", []):
            self.add_transformation(
                tool_type=t_data["tool_type"],
                parameters=t_data["parameters"],
                enabled=t_data.get("enabled", True),
                order_index=t_data.get("order_index", 0)
            )
        
        sampling_data = data.get("sampling_config", {})
        self.set_sampling_config(
            images_per_original=sampling_data.get("images_per_original", 4),
            strategy=sampling_data.get("strategy", "intelligent"),
            fixed_combinations=sampling_data.get("fixed_combinations", 2),
            random_seed=sampling_data.get("random_seed")
        )


# Utility functions for easy usage
def create_schema_from_database(db_transformations: List[Dict], 
                               images_per_original: int = 4) -> TransformationSchema:
    """
    Convenience function to create schema from database records
    """
    logger.info("operations.transformations", "Creating schema from database records", "schema_creation_start", {
        'db_transformations_count': len(db_transformations),
        'images_per_original': images_per_original
    })
    
    schema = TransformationSchema()
    schema.load_from_database_records(db_transformations)
    schema.set_sampling_config(images_per_original=images_per_original)
    
    logger.info("operations.transformations", "Schema created successfully from database", "schema_creation_complete", {
        'transformations_count': len(schema.transformations),
        'enabled_count': len([t for t in schema.transformations if t.enabled])
    })
    
    return schema


def generate_release_configurations(db_transformations: List[Dict], 
                                  image_ids: List[str],
                                  images_per_original: int = 4) -> Dict[str, List[Dict[str, Any]]]:
    """
    Generate transformation configurations for all images in a release
    
    Args:
        db_transformations: List of transformation records from database
        image_ids: List of image IDs to process
        images_per_original: Number of augmented images per original
    
    Returns:
        Dictionary mapping image_id to list of transformation configs
    """
    logger.info("operations.transformations", "Generating release configurations", "release_config_generation_start", {
        'db_transformations_count': len(db_transformations),
        'image_ids_count': len(image_ids),
        'images_per_original': images_per_original
    })
    
    schema = create_schema_from_database(db_transformations, images_per_original)
    
    # Validate schema
    is_valid, errors = schema.validate_configuration()
    if not is_valid:
        logger.error("errors.validation", f"Invalid schema configuration: {errors}", "schema_validation_failed", {
            'errors': errors
        })
        raise ValueError(f"Invalid schema configuration: {errors}")
    
    # Generate configurations for all images
    all_configs = {}
    for image_id in image_ids:
        all_configs[image_id] = schema.generate_transformation_configs_for_image(image_id)
    
    logger.info("operations.transformations", f"Generated configurations for {len(image_ids)} images", "configurations_complete", {
        'image_count': len(image_ids),
        'total_configs': sum(len(image_configs) for image_configs in all_configs.values())
    })
    return all_configs


if __name__ == "__main__":
    # Example usage and testing
    logging.basicConfig(level=logging.INFO)
    
    logger.info("app.backend", "Starting transformation schema test", "test_start", {
        'test_type': 'transformation_schema_example'
    })
    
    # Example transformation records (as they would come from database)
    example_transformations = [
        {
            "transformation_type": "brightness",
            "parameters": {"adjustment": 20},
            "is_enabled": True,
            "order_index": 1
        },
        {
            "transformation_type": "rotate",
            "parameters": {"angle": 15},
            "is_enabled": True,
            "order_index": 2
        },
        {
            "transformation_type": "flip",
            "parameters": {"horizontal": True},
            "is_enabled": True,
            "order_index": 3
        }
    ]
    
    # Test schema creation and configuration generation
    schema = create_schema_from_database(example_transformations, images_per_original=3)
    
    # Generate configurations for sample images
    sample_image_ids = ["img_001", "img_002"]
    configs = generate_release_configurations(
        example_transformations, 
        sample_image_ids, 
        images_per_original=3
    )
    
    logger.info("app.backend", "Transformation schema test completed successfully", "test_complete", {
        'configs_generated': len(configs),
        'total_image_configs': sum(len(image_configs) for image_configs in configs.values())
    })
    
    print("Generated configurations:")
    for image_id, image_configs in configs.items():
        print(f"\n{image_id}:")
        for config in image_configs:
            print(f"  Config {config['order']}: {config['transformations']}")


