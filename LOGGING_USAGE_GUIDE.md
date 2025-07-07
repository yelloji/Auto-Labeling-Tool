# 🔧 SYA Application - Logging System Usage Guide

## 🎯 **SIMPLE 3-STEP USAGE**

### 1️⃣ **START THE APP (As Always)**
```bash
python start.py
```
**✅ This automatically enables all logging!**
- Creates `logs/` directory
- Starts backend with logging
- Starts frontend with logging
- **No extra setup needed!**

### 2️⃣ **VIEW LOGS (Choose Your Method)**

#### 🔍 **Method A: Quick View (Recommended)**
```bash
# Simple log viewer - shows recent entries from all logs
python view_logs.py
```

#### 📁 **Method B: Direct File View**
```bash
# View specific log files
cat logs/backend_api.log      # API requests/responses
cat logs/backend_main.log     # Main application events
cat logs/frontend.log         # Frontend events
cat logs/backend_errors.log   # Errors (hopefully empty!)
```

#### 🌐 **Method C: Via API (While App Running)**
```bash
# Get summary
curl http://localhost:12000/api/v1/logs/summary

# View specific log
curl http://localhost:12000/api/v1/logs/backend_api?lines=50
```

#### 📊 **Method D: Real-Time Monitor (Advanced)**
```bash
# In separate terminal while app is running
python monitor_logs.py
```

### 3️⃣ **THAT'S IT!**
**Logging happens automatically. Just check logs when you need to debug!**

---

## 📁 **LOG FILES EXPLAINED**

| File | What It Contains | When To Check |
|------|------------------|---------------|
| `backend_api.log` | All API requests/responses with timing | API issues, performance |
| `backend_main.log` | App startup, shutdown, main events | App not starting, crashes |
| `frontend.log` | Frontend user actions, errors | UI issues, user problems |
| `backend_database.log` | Database operations, queries | Database errors, slow queries |
| `backend_transformations.log` | Image transformation workflows | Transformation issues |
| `backend_errors.log` | All errors and exceptions | When something breaks |

---

## 🎯 **COMMON SCENARIOS**

### 🐛 **Debugging API Issues**
```bash
# Check API logs
cat logs/backend_api.log
# Look for error status codes or slow response times
```

### 🚀 **App Won't Start**
```bash
# Check main logs
cat logs/backend_main.log
# Look for startup errors or database connection issues
```

### 💻 **Frontend Problems**
```bash
# Check frontend logs
cat logs/frontend.log
# Look for JavaScript errors or failed API calls
```

### 📊 **Performance Issues**
```bash
# Check API response times
grep "Duration:" logs/backend_api.log
# Look for slow requests (>1s)
```

### ❌ **Something Broke**
```bash
# Check error logs first
cat logs/backend_errors.log
# Then check main logs for context
cat logs/backend_main.log
```

---

## 🔄 **LOG MANAGEMENT**

### 📋 **View Recent Activity**
```bash
python view_logs.py
```

### 🧹 **Clear Old Logs**
```bash
# Clear all logs
rm logs/*.log

# Or clear specific log
rm logs/backend_api.log
```

### 📦 **Export Logs**
```bash
# Via API (creates JSON export)
curl -X POST http://localhost:12000/api/v1/logs/export
```

---

## 💡 **PRO TIPS**

### 🔍 **Quick Debug Workflow**
1. **Something wrong?** → `python view_logs.py`
2. **Need more detail?** → `cat logs/backend_errors.log`
3. **API issues?** → `cat logs/backend_api.log`
4. **Still stuck?** → `python monitor_logs.py` (real-time)

### ⚡ **Performance Monitoring**
```bash
# Watch API response times
tail -f logs/backend_api.log | grep "Duration:"

# Monitor errors in real-time
tail -f logs/backend_errors.log
```

### 🎯 **Development Workflow**
1. Start app: `python start.py`
2. Use app normally
3. Check logs when needed: `python view_logs.py`
4. **Logs update automatically!**

---

## ✅ **VERIFICATION**

### 🧪 **Test Logging Works**
```bash
# 1. Start app
python start.py

# 2. In another terminal, check logs
python view_logs.py

# 3. You should see:
#    - Backend startup logs
#    - API request logs
#    - Database initialization logs
```

### 📊 **Check Log Files Exist**
```bash
ls -la logs/
# Should show 6 log files:
# - backend_main.log
# - backend_api.log  
# - backend_database.log
# - backend_transformations.log
# - backend_errors.log
# - frontend.log
```

---

## 🎯 **SUMMARY**

**✅ AUTOMATIC**: Logging works automatically when you run `python start.py`  
**✅ SIMPLE**: Use `python view_logs.py` to see recent activity  
**✅ DETAILED**: Use `cat logs/[filename].log` for full details  
**✅ REAL-TIME**: Use `python monitor_logs.py` for live monitoring  

**🎯 No configuration needed - just start the app and logs work!**