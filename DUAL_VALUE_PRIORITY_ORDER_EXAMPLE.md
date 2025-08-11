# 🎯 DUAL-VALUE PRIORITY ORDER SYSTEM
**Release System - Image Generation Priority Logic**

## 📋 **EXAMPLE SCENARIO**
**User selects:** Brightness + Rotation transformations

### **User Input:**
- Brightness = 0.3
- Rotation = 45°

### **Auto-Generated Values:**
- Brightness = -0.3 (opposite of user's 0.3)
- Rotation = -45° (opposite of user's 45°)

---

## 🚀 **PRIORITY ORDER FOR IMAGE GENERATION**

### **1st PRIORITY: User Selected Values (2 images)**
- **Image 1:** brightness=0.3, rotation=0° (default)
- **Image 2:** brightness=0° (default), rotation=45°

### **2nd PRIORITY: Auto-Generated Values (2 images)**  
- **Image 3:** brightness=-0.3, rotation=0° (default)
- **Image 4:** brightness=0° (default), rotation=-45°

### **3rd PRIORITY: Random Combinations (if user wants more images)**
- **Image 5:** brightness=0.3, rotation=45° (both user values)
- **Image 6:** brightness=-0.3, rotation=-45° (both auto values)
- **Image 7:** brightness=0.3, rotation=-45° (user brightness + auto rotation)
- **Image 8:** brightness=-0.3, rotation=45° (auto brightness + user rotation)
- **Image 9+:** Random values within transformation ranges...

---

## 📊 **MAX IMAGES PER ORIGINAL CALCULATION**

### **Guaranteed Images:**
- **Minimum:** 4 images (2 user + 2 auto)
- **Maximum:** 8+ images (including all combinations)

### **UI Display Logic:**
1. **Transformation Section** → User sets sliders → Click **"Continue"**
2. **Release Configuration Section** → Shows **"Max Images per Original: 4-8"**
3. User sees the limit BEFORE clicking **"Release"** button
4. User can adjust or proceed with Release

---

## 🎯 **KEY BENEFITS**
- **Balanced Dataset:** Equal representation of positive/negative values
- **User Control:** Priority given to user-selected transformations
- **Automatic Augmentation:** System intelligently fills gaps
- **Predictable Output:** Clear priority order for consistent results

---

**Status:** Ready for implementation in Task 3
**Next:** Implement this logic in transformation_config.py and releases.py