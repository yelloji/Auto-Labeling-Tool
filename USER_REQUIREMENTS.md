# User Requirements for Auto-Labeling Tool

## Current Issues to Fix

### 1. Automatic Path Handling
- **Problem**: When moving images from "unassigned" to "annotating" folder, paths become missing
- **Requirement**: This should work automatically without manual intervention
- **Expected Behavior**: Upload dataset → Move to annotating → Images should be immediately visible and accessible

### 2. Label Completion Popup
- **Problem**: When labeling is completed, popup should appear immediately
- **Requirement**: Automatic popup when annotation is finished
- **Expected Behavior**: Draw box → Complete annotation → Popup appears instantly

### 3. Drawing Box Visibility
- **Problem**: Can't see the drawn box properly during annotation
- **Requirement**: Bounding boxes should be clearly visible while drawing
- **Expected Behavior**: Click and drag → See rectangle outline → Release to complete

### 4. Label Saving Issues
- **Problem**: Labels show as saved but don't appear in main label window
- **Requirement**: Saved labels should immediately appear in the interface
- **Expected Behavior**: Save annotation → See it in labels list → See bounding box on image

### 5. Box Visualization
- **Problem**: Even when labels are saved, no bounding boxes are visible on image
- **Requirement**: All saved annotations should be visible on the image
- **Expected Behavior**: Saved boxes should persist and be visible with labels

### 6. Polygon Tool Issues
- **Problem**: When using polygon tool, it's not saving automatically
- **Requirement**: Polygon annotations should auto-save like box annotations
- **Expected Behavior**: Complete polygon → Auto-save → Visible in interface

### 7. Coordinate Corruption
- **Problem**: Previous box label coordinates become 0 in database when using polygon
- **Requirement**: Different annotation tools should not interfere with each other
- **Expected Behavior**: Box annotations remain intact when using polygon tool

## Please specify your exact requirements below:
