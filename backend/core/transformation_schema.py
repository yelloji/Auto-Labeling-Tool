"""
Transformation Schema System for Auto-Labeling Tool Release Pipeline
Handles transformation tool combinations and sampling strategies
"""

import itertools
import random
import logging
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
import json

# Import dual-value transformation functions
from core.transformation_config import (
    is_dual_value_transformation, 
    generate_auto_value,
    DUAL_VALUE_TRANSFORMATIONS
)

logger = logging.getLogger(__name__)

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
        logger.info(f"Added transformation: {tool_type} with parameters: {parameters}")
    
    def load_from_database_records(self, db_transformations: List[Dict]) -> None:
        """Load transformations from database records"""
        self.transformations.clear()
        
        for record in db_transformations:
            if record.get('is_enabled', True):
                # Handle both JSON string and dict parameters
                parameters = record['parameters']
                if isinstance(parameters, str):
                    try:
                        parameters = json.loads(parameters)
                    except json.JSONDecodeError:
                        logger.error(f"Failed to parse parameters for {record['transformation_type']}")
                        continue
                
                self.add_transformation(
                    tool_type=record['transformation_type'],
                    parameters=parameters,
                    enabled=record.get('is_enabled', True),
                    order_index=record.get('order_index', 0)
                )
        
        # Sort by order_index
        self.transformations.sort(key=lambda x: x.order_index)
        logger.info(f"Loaded {len(self.transformations)} transformations from database")
        
        # Calculate and log combination count
        combination_count = self.get_combination_count_estimate()
        logger.info(f"Maximum possible combinations: {combination_count}")
    
    def generate_single_value_combinations(self) -> List[Dict[str, Any]]:
        """
        Generate all possible combinations from single-value transformations
        Phase 1: Uses current single-value system
        """
        if not self.transformations:
            logger.warning("No transformations available for combination generation")
            return [{}]  # Return empty config for no transformations
        
        # Get enabled transformations only
        enabled_transformations = [t for t in self.transformations if t.enabled]
        
        if not enabled_transformations:
            logger.warning("No enabled transformations found")
            return [{}]
        
        # For single-value system, each transformation contributes one value
        # Generate combinations by including/excluding each transformation
        combinations = []
        
        # Generate all possible combinations (2^n where n is number of transformations)
        for i in range(1, 2 ** len(enabled_transformations)):
            combination = {}
            
            for j, transformation in enumerate(enabled_transformations):
                # Check if this transformation is included in current combination
                if i & (1 << j):
                    combination[transformation.tool_type] = transformation.parameters
            
            combinations.append(combination)
        
        logger.info(f"Generated {len(combinations)} single-value combinations")
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
            logger.warning("No transformations available for dual-value combination generation")
            return [{}]
        
        # Get enabled transformations only
        enabled_transformations = [t for t in self.transformations if t.enabled]
        
        if not enabled_transformations:
            logger.warning("No enabled transformations found")
            return [{}]
        
        combinations = []
        
        # Separate dual-value and regular transformations
        dual_value_transformations = []
        regular_transformations = []
        
        for transformation in enabled_transformations:
            if is_dual_value_transformation(transformation.tool_type):
                dual_value_transformations.append(transformation)
            else:
                regular_transformations.append(transformation)
        
        # PRIORITY 1: User Selected Values (individual transformations)
        logger.info("Generating Priority 1: User Selected Values")
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
            logger.debug(f"Added user value combination: {combination}")
        
        # PRIORITY 2: Auto-Generated Values (opposite values)
        logger.info("Generating Priority 2: Auto-Generated Values")
        for transformation in dual_value_transformations:
            auto_params = {}
            
            # Generate auto values for each parameter
            for param_name, param_value in transformation.parameters.items():
                if isinstance(param_value, dict) and 'user_value' in param_value:
                    # Already in dual-value format
                    user_value = param_value['user_value']
                    auto_value = generate_auto_value(transformation.tool_type, user_value)
                    auto_params[param_name] = auto_value
                else:
                    # Single value - generate auto value
                    auto_value = generate_auto_value(transformation.tool_type, param_value)
                    auto_params[param_name] = auto_value
            
            combination = {transformation.tool_type: auto_params}
            combinations.append(combination)
            logger.debug(f"Added auto value combination: {combination}")
        
        # PRIORITY 3: Random Combinations (if more images needed)
        logger.info("Generating Priority 3: Random Combinations")
        if len(combinations) < self.sampling_config.images_per_original:
            remaining_slots = self.sampling_config.images_per_original - len(combinations)
            
            # Generate combinations of both user and auto values
            all_values = []
            
            # Collect all user and auto values
            for transformation in dual_value_transformations:
                user_params = transformation.parameters.copy()
                auto_params = {}
                
                for param_name, param_value in transformation.parameters.items():
                    if isinstance(param_value, dict) and 'user_value' in param_value:
                        user_params[param_name] = param_value['user_value']
                        auto_params[param_name] = param_value.get('auto_value', 
                                                               generate_auto_value(transformation.tool_type, param_value['user_value']))
                    else:
                        auto_params[param_name] = generate_auto_value(transformation.tool_type, param_value)
                
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
            
            # Add random combinations up to the limit
            random.shuffle(additional_combinations)
            combinations.extend(additional_combinations[:remaining_slots])
        
        logger.info(f"Generated {len(combinations)} dual-value combinations with priority order")
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
        
        logger.info(f"Sampled {len(sampled)} combinations from {len(combinations)} total")
        return sampled
    
    def generate_transformation_configs_for_image(self, image_id: str) -> List[Dict[str, Any]]:
        """
        Generate transformation configurations for a single image
        Returns list of configs to apply to the image
        """
        # Check if we have dual-value transformations
        has_dual_value_transformations = any(
            is_dual_value_transformation(t.tool_type) 
            for t in self.transformations if t.enabled
        )
        
        # Generate combinations based on system type
        if has_dual_value_transformations:
            logger.info(f"Using dual-value combination generation for image {image_id}")
            all_combinations = self.generate_dual_value_combinations()
        else:
            logger.info(f"Using single-value combination generation for image {image_id}")
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
        
        logger.info(f"Generated {len(configs_with_metadata)} transformation configs for image {image_id}")
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
        logger.info(f"Updated sampling config: {self.sampling_config}")
    
    def get_combination_count_estimate(self) -> int:
        """Estimate total number of possible combinations including original"""
        enabled_transformations = [t for t in self.transformations if t.enabled]
        if not enabled_transformations:
            return 1
        
        # Check if we have dual-value transformations
        dual_value_transformations = [t for t in enabled_transformations if is_dual_value_transformation(t.tool_type)]
        regular_transformations = [t for t in enabled_transformations if not is_dual_value_transformation(t.tool_type)]
        
        if dual_value_transformations:
            # For dual-value system: Calculate based on priority order
            dual_count = len(dual_value_transformations)
            regular_count = len(regular_transformations)
            
            # Minimum guaranteed: 2 * dual_count (user + auto values)
            # Maximum possible: includes all combinations
            min_combinations = 2 * dual_count
            max_combinations = min_combinations + (2 ** dual_count) + (2 ** regular_count)
            
            # Return the minimum guaranteed for UI display
            return min_combinations
        else:
            # For single-value system: 2^n (including original file)
            return (2 ** len(enabled_transformations))
    
    def validate_configuration(self) -> Tuple[bool, List[str]]:
        """
        Validate the current schema configuration
        Returns (is_valid, list_of_errors)
        """
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
        return is_valid, errors
    
    def to_dict(self) -> Dict[str, Any]:
        """Export schema configuration to dictionary"""
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
    schema = TransformationSchema()
    schema.load_from_database_records(db_transformations)
    schema.set_sampling_config(images_per_original=images_per_original)
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
    schema = create_schema_from_database(db_transformations, images_per_original)
    
    # Validate schema
    is_valid, errors = schema.validate_configuration()
    if not is_valid:
        raise ValueError(f"Invalid schema configuration: {errors}")
    
    # Generate configurations for all images
    all_configs = {}
    for image_id in image_ids:
        all_configs[image_id] = schema.generate_transformation_configs_for_image(image_id)
    
    logger.info(f"Generated configurations for {len(image_ids)} images")
    return all_configs


if __name__ == "__main__":
    # Example usage and testing
    logging.basicConfig(level=logging.INFO)
    
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
    
    print("Generated configurations:")
    for image_id, image_configs in configs.items():
        print(f"\n{image_id}:")
        for config in image_configs:
            print(f"  Config {config['order']}: {config['transformations']}")
