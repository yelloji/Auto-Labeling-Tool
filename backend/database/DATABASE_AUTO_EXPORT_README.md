# Database Auto-Export System

This system automatically exports database information to human-readable JSON and CSV files whenever the database changes.

## 📁 Output Files

The system creates the following files in the `database_exports/` directory:

### JSON Export (`database_export.json`)
- **Complete database snapshot** with all relationships
- **Hierarchical structure**: Projects → Datasets → Images → Annotations
- **Easy to read** and parse programmatically
- **Best for**: Detailed analysis, debugging, API integration

### CSV Exports
- **`projects.csv`**: All projects with basic info
- **`datasets.csv`**: All datasets with project relationships
- **`images.csv`**: All images with detailed metadata
- **Best for**: Excel analysis, reporting, data science

## 🚀 How It Works

### Automatic Mode (Recommended)
The system starts automatically when you run the main application:
```bash
python backend/main.py
```

### Manual Mode
You can also run it separately:
```bash
# One-time export
python backend/start_auto_export.py

# Continuous monitoring
python backend/start_auto_export.py --monitor

# Custom settings
python backend/start_auto_export.py --monitor --interval 5 --export-dir my_exports
```

## 📊 What Gets Exported

### Projects
- ID, name, description
- Creation/update timestamps
- Dataset count, image count
- Label information

### Datasets
- ID, name, description
- Project relationship
- Image counts by split (train/val/test)
- Creation/update timestamps

### Images
- ID, filename, file path
- Dimensions, file size
- Split assignment (train/val/test)
- Annotation count
- Labeling status

### Annotations
- Bounding boxes, polygons, classifications
- Label assignments
- Confidence scores
- Creation timestamps

## ⚡ Performance

- **Lightweight**: Only exports when changes are detected
- **Fast**: Incremental updates, not full rebuilds
- **Non-blocking**: Runs in background threads
- **Safe**: No impact on main application performance

## 🔧 Configuration

The system uses a dedicated configuration file: `backend/database/export_config.py`

### 🌍 Environment Types (Line 38 in export_config.py)

**DEVELOPMENT** (default)
- ✅ Full monitoring enabled
- ✅ Real-time database change detection
- ✅ Frequent exports (every 10 seconds)
- ✅ Verbose logging for debugging

**PRODUCTION**
- ❌ Monitoring automatically disabled for performance
- ✅ Manual exports only (no real-time monitoring)
- ✅ Optimized for production servers
- ✅ Minimal resource usage

**TESTING**
- ⚙️ Flexible monitoring (can be enabled/disabled)
- ⚙️ Controlled testing of export functionality
- ⚙️ Useful for CI/CD pipelines and unit tests
- ⚙️ Customizable for test scenarios

### 🔧 Configuration Options

**Main Configuration File:** `backend/database/export_config.py`

| Setting | Line # | Default | Description |
|---------|--------|---------|-------------|
| `ENABLE_AUTO_EXPORT` | 15 | `True` | Enable/disable entire system |
| `ENABLE_MONITORING` | 19 | `True` | Enable real-time monitoring |
| `EXPORT_DIRECTORY` | 22 | `"database_exports"` | Export folder path |
| `CHECK_INTERVAL` | 23 | `10` | Check interval in seconds |
| `EXPORT_JSON` | 26 | `True` | Enable JSON export |
| `EXPORT_CSV` | 27 | `True` | Enable CSV export |
| `ENVIRONMENT` | 38 | `"development"` | Environment type |

### 🌐 Environment Variables

Control the system using environment variables with the `DB_EXPORT_` prefix:

```bash
# Main toggles
DB_EXPORT_ENABLE_AUTO_EXPORT=true
DB_EXPORT_ENABLE_MONITORING=true
DB_EXPORT_ENVIRONMENT=development

# Export settings
DB_EXPORT_EXPORT_DIRECTORY=database_exports
DB_EXPORT_CHECK_INTERVAL=10
DB_EXPORT_EXPORT_JSON=true
DB_EXPORT_EXPORT_CSV=true
```

### 🚀 Quick Setup Examples

**For Development:**
```bash
DB_EXPORT_ENVIRONMENT=development
DB_EXPORT_ENABLE_MONITORING=true
DB_EXPORT_CHECK_INTERVAL=10
```

**For Production:**
```bash
DB_EXPORT_ENVIRONMENT=production
DB_EXPORT_ENABLE_MONITORING=false
DB_EXPORT_CHECK_INTERVAL=30
```

**For Testing:**
```bash
DB_EXPORT_ENVIRONMENT=testing
DB_EXPORT_ENABLE_MONITORING=true
DB_EXPORT_CHECK_INTERVAL=5
```

### ⚡ Direct File Editing

To change settings directly in the config file:

1. Open `backend/database/export_config.py`
2. Find the setting you want to change (see line numbers above)
3. Modify the default value
4. Restart the application

**Example - Disable monitoring (Line 19):**
```python
# Change this line:
ENABLE_MONITORING: bool = True
# To this:
ENABLE_MONITORING: bool = False
```

**Example - Change environment (Line 38):**
```python
# Change this line:
ENVIRONMENT: str = "development"
# To this:
ENVIRONMENT: str = "production"
```

## 📋 File Examples

### JSON Structure
```json
{
  "export_info": {
    "timestamp": "2024-01-20T10:30:00Z",
    "total_projects": 3,
    "total_datasets": 8,
    "total_images": 1250
  },
  "projects": [
    {
      "id": 1,
      "name": "Vehicle Detection",
      "datasets": [
        {
          "id": 1,
          "name": "Training Set",
          "images": [...]
        }
      ]
    }
  ]
}
```

### CSV Structure
```csv
project_id,project_name,dataset_count,image_count,created_at
1,"Vehicle Detection",3,450,"2024-01-15 09:00:00"
2,"Face Recognition",2,800,"2024-01-16 14:30:00"
```

## 🛠️ Troubleshooting

### Files Not Updating?
1. Check if the main application is running
2. Verify the `database_exports/` directory exists
3. Look for error messages in the application logs

### Performance Issues?
1. Increase the check interval: `--interval 30`
2. Disable file monitoring: `--disable-hooks`
3. Use manual exports instead of continuous monitoring

### Missing Data?
1. Check database connectivity
2. Verify all models are properly imported
3. Run a manual export to test: `python backend/start_auto_export.py`

## 📞 Support

If you encounter issues:
1. Check the application logs for error messages
2. Try running a manual export first
3. Verify database connectivity
4. Check file permissions in the export directory

---

**Note**: This system replaces the need to manually run `debug_database.py` in the terminal. Your data is now always up-to-date and easily accessible!