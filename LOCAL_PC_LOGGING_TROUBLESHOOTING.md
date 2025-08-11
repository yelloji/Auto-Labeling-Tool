# 🔍 Local PC Logging Troubleshooting Guide

## ❓ **Why Logs Might Not Appear on Your Local PC**

### 🎯 **Most Common Issues:**

## 1. **📁 Wrong Working Directory**
**Problem**: Running the backend from wrong directory
```bash
# ❌ WRONG - Running from backend folder
cd app-2/backend
python -m uvicorn main:app --reload

# ✅ CORRECT - Running from app-2 root
cd app-2
cd backend
python -m uvicorn main:app --reload
```

**Solution**: Always run from `app-2` root directory, then `cd backend`

## 2. **📂 Missing Logs Directory**
**Problem**: The `logs` folder doesn't exist
```bash
# Check if logs folder exists
ls -la logs/
```

**Solution**: Create the logs directory manually
```bash
mkdir logs
```

## 3. **🔐 Permission Issues (Windows/Mac)**
**Problem**: No write permissions to create log files

**Windows Solutions**:
- Run Command Prompt as Administrator
- Check if antivirus is blocking file creation
- Disable Windows Defender real-time protection temporarily
- Move app-2 folder to a location with full permissions (like Desktop)

**Mac/Linux Solutions**:
```bash
# Give write permissions to app-2 directory
chmod -R 755 app-2/
# Or run with sudo (not recommended for development)
sudo python -m uvicorn main:app --reload
```

## 4. **🦠 Antivirus Blocking**
**Problem**: Antivirus software blocking log file creation

**Solutions**:
- Add `app-2` folder to antivirus exclusions
- Temporarily disable real-time protection
- Use Windows Defender exclusions: Settings → Update & Security → Windows Security → Virus & threat protection → Exclusions

## 5. **🐍 Python Path Issues**
**Problem**: Logger can't find the correct path

**Solution**: Verify Python is finding the logger module
```python
# Test in Python console
import sys
sys.path.append('backend')
from utils.logger import sya_logger
print(f"Log directory: {sya_logger.log_dir}")
```

## 6. **🚀 Backend Not Starting Properly**
**Problem**: Backend crashes before creating logs

**Check**:
```bash
# Check if backend is running
curl http://localhost:12000/health
# Or check process
ps aux | grep uvicorn
```

## 🧪 **Quick Diagnostic Test**

Run this in your `app-2` directory:

```python
# Save as test_logging.py in app-2 root
import os
import sys
sys.path.append('backend')

try:
    from utils.logger import sya_logger, log_info
    print(f"✅ Logger working! Log dir: {sya_logger.log_dir}")
    log_info("TEST MESSAGE - Check logs folder!")
    
    # Check if logs were created
    if os.path.exists('logs'):
        log_files = os.listdir('logs')
        print(f"📋 Log files: {log_files}")
    else:
        print("❌ No logs directory found")
        
except Exception as e:
    print(f"❌ Error: {e}")
```

## 🎯 **Expected Log Files**

When working correctly, you should see these files in `app-2/logs/`:

```
logs/
├── backend_main.log          # Main application logs
├── backend_api.log           # API request/response logs  
├── backend_database.log      # Database operation logs
├── backend_transformations.log # Image transformation logs
└── backend_errors.log        # Error logs only
```

## 🔧 **Manual Log Directory Setup**

If automatic creation fails, create manually:

```bash
# In app-2 root directory
mkdir logs
touch logs/backend_main.log
touch logs/backend_api.log  
touch logs/backend_database.log
touch logs/backend_transformations.log
touch logs/backend_errors.log

# Set permissions (Mac/Linux)
chmod 755 logs/
chmod 644 logs/*.log
```

## 🚨 **Emergency Logging (If All Else Fails)**

Add this to `backend/main.py` for console-only logging:

```python
import logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]  # Console only
)
```

## ✅ **Verification Steps**

1. **Check directory structure**:
   ```
   app-2/
   ├── backend/
   ├── frontend/
   ├── logs/          ← Should exist
   └── database.db
   ```

2. **Test logging**:
   ```bash
   cd app-2
   python test_logging.py
   ```

3. **Start backend and check logs**:
   ```bash
   cd app-2/backend
   python -m uvicorn main:app --reload
   # Check logs folder for new entries
   ```

4. **Verify log content**:
   ```bash
   tail -f logs/backend_main.log
   ```

## 🎯 **Success Indicators**

✅ `logs/` directory exists in `app-2/`  
✅ Log files are created and growing in size  
✅ Console shows log messages  
✅ Backend starts without errors  
✅ API calls generate log entries  

If you're still having issues, the problem is likely:
- **Windows**: Antivirus or permissions
- **Mac**: Permissions or Python path
- **Linux**: Permissions or directory structure

**Try running the debug script we created to get specific error details!**