# VENKATA RAKESH YELLOJI
**ML Solutions Architect | Founding AI Engineer**

📧 venkatarakesh1996@gmail.com | 📱 (+39) 353 399 0648  
🔗 linkedin.com/in/yelloji-venkatrakesh | 📍 Parma, Italy (Open to Remote EU)

---

## WHO I AM

**Natural problem solver** who built complete AI division from zero in company with no AI expertise. **2 years solo experience** delivering 5 production computer vision models and comprehensive ML platform. Expert at **identifying problems, designing solutions, and delivering results** - regardless of prior experience.

**Core Strength:** Problem → Solution → Implementation (with team support)  
**Passion:** Computer vision problems in industrial/manufacturing domains  
**Approach:** Vision-driven, results-focused, never accept mediocre output

---

## PROFESSIONAL SUMMARY

**Founding AI Engineer** who independently built AI capability in 15-person company from zero knowledge to 5 production deployments. Solved complex industrial defect detection problems (1-2 pixel objects, 50-200 images, 95%+ accuracy) through innovative ML strategies discovered independently. Architect of a comprehensive ML platform spanning **100+ files and ~150,000 lines of code**, demonstrating immense product vision and technical leadership.

**Unique Value:**
- ✅ **Solution Architecture:** Design complete ML systems from problem to production
- ✅ **Independent Innovation:** Discovered advanced techniques (negative sampling) through research
- ✅ **Integral Architecture:** Designed a unified Training-to-Validation lifecycle loop that reduced friction by 40%
- ✅ **Product Vision:** Built enterprise-grade platform (**150k+ LOC, 100+ files**) from imagination to reality
- ✅ **Founding Experience:** Solo AI division builder - all decisions, all problems, all solutions mine
- ✅ **Results Focus:** Never accept failure, deliver expected output, no compromise

---

## PROFESSIONAL EXPERIENCE

### **Founding AI Engineer (Solo ML Division)**
**Vision Systems Company** | Parma, Italy | October 2022 - Present

**Context:** Joined 15-person company with **ZERO AI knowledge**. Built entire AI capability solo. Only AI person - no team, no mentors, no support. Every problem → Internet research → Solution design → Implementation.

#### **Production ML Solutions (5 Deployed Models)**

**Built AI Division from 0 → 5 Production Models:**
- Achieved **95%+ accuracy** with severely limited data (50-200 images)
- Solved hardest CV problems: **1-2 pixel defects** in noisy grayscale industrial images
- Deployed to manufacturing quality control (zero false negative tolerance)
- All models stable and operational 18+ months
- **Sole technical decision-maker** for all ML strategy

**Signature Innovation - Negative Sampling for False Positives:**

**Problem Identified:**
- Grayscale images + heavy noise → Model learned noise patterns as defects
- High false positive rate on good images (unacceptable in production)

**Root Cause Analysis:**
- Model never learned what "good" images look like
- Training only on defect examples = incomplete learning

**Solution Designed:**
- **Strategy:** 50% labeled defects + 50% unlabeled good images
- **Logic:** Model learns both IS defect AND is NOT defect
- **Validation:** Excluded good images from test set (clean accuracy metrics)

**Result:**
- **40%+ false positive reduction**
- Successfully deployed to zero-tolerance production line
- **Self-discovered advanced ML technique** (hard negative mining)
- Operational for 18+ months without issues

**ML Expertise Demonstrated:**
- **Advanced Techniques:** Negative sampling, active learning, dual-value augmentation
- **Model Optimization:** YOLO v8-v11 fine-tuning, transfer learning, GPU optimization
- **Data Strategy:** 18 custom augmentation techniques, intelligent parameter adaptation
- **Production Mindset:** Validation protocols, accuracy testing, deployment specification
- **Domain Mastery:** Small object detection, limited data ML, noise handling

**Cross-Functional Impact:**
- Specified model requirements for C++ integration team
- Consulted with customers on detection capabilities
- Made ALL technical ML decisions independently
- **Sole AI expert** in 15-person company

---

#### **Product Leadership - ML Platform Architecture (Side Project)**

**Context:** This was a **personal initiative / side project**, NOT core job requirement. Built to demonstrate product vision and solve workflow inefficiencies.

**Vision:** Not requested by CEO - self-initiated to showcase product thinking and architecture skills.

**What I Imagined & Built:**

**Technical Scope:**
- **Scale:** ~150,000 lines of custom code across 100+ professional modules/components
- **Backend:** Professional Python architecture (FastAPI, SQLAlchemy, background jobs)
- **Frontend:** Modern React ecosystem (Ant Design, pixel-perfect UX)
- **Database:** Enterprise-grade schema (projects, datasets, images, annotations, training, releases)
- **Features:** Multi-project support, versioning, analytics, active learning

**Development Approach:**
- Designed complete **Unified Lifecycle Architecture** (Training + Labeling + Analytics in one loop)
- Leveraged AI coding tools (Cursor, Claude) for implementation
- **My role:** Vision, architecture, design, decisions, validation
- **AI tools:** Code writing under my direction

**Key Innovations I Designed:**

1. **Dual-Value Augmentation Logic:**
   - Problem: Standard augmentation either too weak or destroys small defects
   - Solution: Smart system that decides single vs dual output based on effectiveness
   - Impact: Better generalization without losing small object detection

2. **Intelligent Dataset Rebalancing:**
   - Problem: Need flexible train/val/test splits for experimentation
   - Solution: Dynamic rebalancing with random sampling, multiple versions
   - Impact: Faster experimentation, better model optimization

3. **Active Learning Pipeline:**
   - Problem: Manual labeling inefficient, which 200 images to label?
   - Solution: Uncertainty-based selection prioritizes valuable samples
   - Impact: 60% reduction in labeling effort

4. **18 Augmentation Techniques:**
   - Each with smart parameter adaptation
   - Preserves critical features for small objects
   - Production-tested across all 5 models

5. **Cognitive UX & The "Health Score":**
   - Problem: AI metrics (P-R, F1) are too technical for business decisions.
   - Solution: Designed a single color-coded "Project Grade" (70% Accuracy / 20% Autonomy / 10% Sloppiness).
   - Impact: Allows instant "Production Ready" decisions by non-experts.

6. **Dual-Mode Audit Architecture:**
   - Problem: Verifying 1,000s of images is an "Audit Bottleneck."
   - Solution: Designed "Split" (Lab) vs "Upload" (Field) modes with "Assumed Correct" logic.
   - Impact: Transformed 100-hour labeling tasks into 10-minute exception reviews.

7. **Static Reality Anchor:**
   - Problem: Metrics lose meaning when "Truth" shifts with filter settings.
   - Solution: Architected a stable denominator logic that locks reality while tuning the model.
   - Impact: Provides a "Scientific Instrument" feel, giving users total confidence in the data.

**Business Impact:**
- Used across all 5 production projects
- 30% faster model development time
- Improved model quality and team efficiency
- Demonstrated product thinking and technical leadership

**What This Proves:**
- **Product Vision:** Saw problem, imagined solution, made it real
- **Architecture Skills:** Designed complex system organization
- **No Compromise:** Built best platform, not minimum viable
- **Initiative:** Self-driven, didn't wait for permission

8. **Integral "Image-to-Metric" Pipeline:**
   - Problem: Traditionally, "Labeling" and "Analytics" are disconnected silos.
   - Solution: Designed a **Bidirectional Logic Bridge** where human actions in the pixel-perfect Image Viewer (marking labels/junk) are **instant drivers** for the global Analytics suite.
   - Impact: Created a "Living Dashboard" that evolves with every human click, providing a real-world "Feedback Sensor" for the Training engine.

9. **The "Prediction Insight" Viewer:**
   - Problem: Standard galleries only show boxes; they don't provide "Intelligence."
   - Solution: Designed a high-stakes **PredictionView** that integrates manual verification with real-time biometric-style analytics. 
   - Impact: Allows users to "see through the eyes of the AI" to identify exactly why a model is failing in specific environmental conditions.

---

**Overall Company Impact:**
- Built AI capability: €0 → 5 production models generating revenue
- Reduced false alarm rates improving production efficiency
- Created reusable platform accelerating future projects
- **Proved: One person can build an integrated AI division (Engine + Interface + Analytics) from zero**

---

### **Data Scientist Intern**
**iNeuron Intelligence Pvt Ltd** | Karnataka, India (Remote) | Feb 2020 - Oct 2020

Foundational ML experience during master's degree:
- Learned ML fundamentals: regression, trees, XGBoost, clustering
- Built "Safety with Shredder Machine" using object detection
- Deployed model to Raspberry Pi
- Applied Pandas, Scikit-Learn, NumPy

---

## EDUCATION

**Master of Science in Communication Engineering**  
**Università degli Studi di Parma** | Italy | 2018-2022

**Thesis:** Ensemble CNN Models for Image Classification (CIFAR-10)

**Academic Projects:** Vehicle detection, tomato leaf disease prediction, house price prediction

---

## TECHNICAL SKILLS

### **ML/AI Coding** ✅
**Proficient:**
- Python for ML/AI (model training, data processing, experimentation)
- Write computer vision scripts and pipelines
- Debug model performance and optimize accuracy
- **Note:** This is my core work - I CAN code for ML tasks

### **ML Strategy & Architecture**
**Expert:** Solution design, problem diagnosis, model strategy, data strategy  
**Proven:** Limited data ML, small object detection, industrial CV, production deployment

### **Computer Vision**
**Expert:** YOLO (v8-v11), **Integral AI Lifecycle Design**, Object Detection
**Proven:** Limited data ML, small object detection, industrial CV, **Cognitive UX Thinking**

### **Tools & Frameworks**
**ML:** PyTorch, Ultralytics, Scikit-Learn, Pandas, NumPy  
**Development:** Python, Git, Docker, Linux, VS Code, Cursor AI  
**Data:** SQL, SQLite, PostgreSQL  
**AI-Assisted:** FastAPI, React (with AI tools for implementation)

### **Domain Expertise**
- Industrial Quality Control
- Manufacturing Defect Detection  
- Grayscale/Noisy Environments
- Sub-pixel Object Detection
- False Positive Reduction

### **Core Competencies**
- Problem Diagnosis & Root Cause Analysis
- Solution Architecture & System Design
- Independent Research & Self-Learning
- Product Vision & UX Thinking
- Technical Decision-Making (Solo)
- Fast Learning & Adaptation

---

## KEY ACHIEVEMENTS

✅ **Built AI Division Solo** - 0 → 5 production models in company with zero AI knowledge  
✅ **95%+ Accuracy** - Limited data (50-200 images), hardest CV problems (1-2 pixels)  
✅ **Advanced Innovation** - Self-discovered negative sampling technique  
✅ **Platform Architecture** - Built complete ML system (78 modules + 43 components)  
✅ **Zero Failures** - All 5 models operational 18+ months  
✅ **40% False Positive Reduction** - Innovative training strategy  
✅ **60% Labeling Efficiency** - Active learning pipeline  
✅ **Enterprise Scale** - Built complete ML system (**100+ files, 150k+ lines of code**)
✅ **Structural Uniqueness** - Architected a closed-loop system where Verification, Training, and Analytics are a single, integral engine.
✅ **Cognitive UI Innovation** - Created "AI Detection Health" master grade for managers
✅ **100% Ownership** - All ML decisions, all problems, all solutions

---

## WHAT I BRING

**Problem-Solving Approach:**
1. **Problem** → I analyze and identify root cause
2. **Solution** → I design approach (often innovative)
3. **Trial** → I test solution proactively
4. **Iteration** → I improve until it works perfectly
5. **Delivery** → I never accept failure, deliver expected output

**My Value Proposition:**
- **Don't just use tools** → I innovate solutions (negative sampling proves it)
- **Don't wait for instructions** → I identify problems and solve them proactively
- **Don't accept mediocre** → I deliver best possible output, no compromise
- **Don't need hand-holding** → I research, learn, execute independently

**Best For:**
- Companies needing ML STRATEGY, not just coding
- Roles where WHAT to build matters more than HOW
- Problems requiring creativity, not just following documentation
- Teams needing independent technical decision-makers

**Honest Note:**
I can code Python for ML/AI work (model training, data processing, optimization). The web platform was a **side project** to demonstrate product vision and architecture thinking - built using AI development tools to accelerate implementation. My strength is ML strategy and problem-solving. I work best in roles focused on WHAT to build (ML solutions) rather than HOW to implement (software engineering).

---

## TARGET ROLES

**Seeking:**
1. **ML Solutions Architect** (Dream role - €70-90K)
2. **Technical Product Manager - AI/ML** (Perfect fit - €65-85K)
3. **Founding AI Engineer / AI Team Lead** (Similar to current - €70-90K)
4. **Computer Vision Specialist** (Domain fit - €65-80K)

**NOT Seeking:**
- Traditional Software Engineer roles
- Pure Backend/Frontend Developer
- Research Scientist (PhD-track)

---

## SALARY & LOGISTICS

**Expectations:**
- **Italy:** €65,000 - €85,000 gross/year
- **Remote EU:** €85,000 - €110,000 gross/year

**Availability:**
- Notice Period: 2 months
- Start: April-May 2025
- Location: Remote/Hybrid preferred, open to relocation
- Travel: Yes, for customer meetings

**Work Authorization:** Valid for Italy and EU

---

## LANGUAGES

**English:** Professional (C1) | **Telugu:** Native | **Hindi:** Fluent | **Italian:** Intermediate (B1)

---

## WHY HIRE ME

**What Other Candidates Bring:**
- Strong coding skills ✓
- Following best practices ✓
- Team collaboration ✓

**What I ADDITIONALLY Bring:**
- ✅ **Founding Engineer Mindset** - Built AI division from zero alone
- ✅ **Innovation Under Constraints** - Solved problems with limited resources
- ✅ **Complete Ownership** - Comfortable being sole decision-maker
- ✅ **Product Thinking** - Built platform showing vision and UX focus
- ✅ **Never Give Up** - Will find solution regardless of obstacles

**Proof:**
- Joined company with zero AI → Built 5 production models solo
- Had coding limitations → Built 78-module platform with AI tools
- Faced false positive problem → Invented negative sampling solution
- Needed better workflow → Architected **Integrated Training-to-Validation Platform**

**Track Record:** Problem appears → I find solution → It works

---

## REFERENCES

Available upon request.

---

**Last Updated:** December 2025  
**CV Type:** ML Solutions Architect / Founding AI Engineer  
**Experience Level:** Senior (2 years founding experience = 3-4 years traditional team experience)
