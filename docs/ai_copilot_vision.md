# Super Solution: Local AI Copilot Vision

This document outlines the technical plan for integrating a **Local AI Copilot** into the Auto-Labeling Tool. The goal is to create a seamless, human-like assistant that helps users navigate the complex UI and provides scientific insights into their models.

## **Core Philosophy**
The Copilot is not just a "chatbot." it is an **Orchestrator** that understands the project state and can physically control the application UI on behalf of the user.

---

## **Technical Architecture (Local-First)**

### **1. Hardware Optimization (12GB VRAM)**
To ensure high speed and zero cost, the system will run locally on the user's hardware.
*   **Recommended Model**: `Llama-3-8B-Instruct` or `Mistral-7B-v0.3`.
*   **Optimization**: 4-bit or 8-bit Quantization (using `Ollama` or `LM Studio` backend).
*   **VRAM Usage**: ~5GB to 8GB, leaving enough room for image processing and training.

### **2. The "Context Bridge"**
The app will continuously maintain a "Live Project Snapshot" in JSON format:
```json
{
  "current_page": "ModelLab",
  "active_tab": "Validation",
  "data_stats": { "images": 520, "labeled": 480 },
  "last_metrics": { "mAP": 0.82, "best_class": "person", "worst_class": "dog" }
}
```

### **3. Function Calling (The Remote Control)**
The AI will have access to specific "Tools" to modify the UI:
*   `navigateTo(tabName)`: Changes the active view.
*   `startValidation(params)`: Triggers the validation process.
*   `highlightMetric(metricName)`: Scrolls to and highlights a specific card.
*   `openLabeler(imageId)`: Jumps directly to an image for corrective labeling.

---

## **Key "Super" Features**

### **A. Guided Navigation**
*   **User**: "I have 50 new images. What do I do?"
*   **AI**: "I see the new images in the staging area. Let's start by **Uploading** them. I'll take you there now." (App automatically switches to Upload tab).

### **B. Scientific Insights**
Instead of just showing numbers, the AI explains them:
*   **AI**: "I noticed your **'Hard Hat'** recall dropped by 12% in this run. Looking at the confusion matrix, it's being confused with **'Person'**. You might want to add more zoomed-in images of hats."

### **C. Proactive Human-Like Support**
The AI "wakes up" on its own when tasks finish:
*   **Event**: Validation finishes with improved mAP.
*   **AI Pop-up**: "Impressive! This run is your best yet (mAP 0.91). Should we **Export** these weights as your 'Production' model, or do you want to try one more tweak?"

---

## **Implementation Priority**
1.  **Preparation**: Finalize current UI fixes (Layout, Scrolling, Zooming).
2.  **Shell**: Add a persistent, sleek "Copilot Window" in the sidebar.
3.  **Local Backend**: Connect to a local Ollama/Llama server.
4.  **Tools**: Map AI functions to React state changes.
5.  **Intelligence**: Feed scientific metrics into the prompt.
