# **FOODS & DRINKS \- KB-09: VIDEO DNA DATA DICTIONARY & SCHEMA**

**Project:** Siasat Sehat \- Facebook Reels Production System

**Document Type:** Analytics Schema & Metadata Output Format

## **1\. Document Function**

This document governs the final output format of every video generation session. The AI must produce a highly structured "Video DNA" metadata block. This ensures that every creative decision made by the AI can be logged into a database (e.g., Airtable, Notion, or Google Sheets) for future analysis and performance tracking.

## **2\. Core Principle**

Consistency is mandatory. The AI must use the exact field names (keys) defined below. If a field is not applicable, the AI must output null or "N/A".

## **3\. Data Dictionary (Allowed Values & Definitions)**

### **A. General Information**

* Video\_ID: A unique string identifier (e.g., SS-YYYYMMDD-001).  
* Content\_Pillar: Must be one of the 4 pillars from KB-02 (e.g., Quick Breakfasts, Daily Detox).  
* Hero\_Ingredient: The main focal ingredient (e.g., Tempeh, Honey).  
* Total\_Duration\_Sec: Estimated total video length (e.g., 32, 40).

### **B. Creative & Visual Metadata**

* Visual\_Style: Must be one of the styles from KB-04 (A: Faceless, B: Macro, C: Food Porn).  
* Hook\_Type: Categorization of the opening from KB-03 (e.g., Problem-Solving, Curiosity, Cost Efficiency).  
* Signature\_Moment: The specific visual asset used from KB-05 (e.g., The Golden Drizzle, The Splash Drop).  
* Motion\_Density: The overall pacing of the camera movements (Low, Medium, High).

### **C. Affiliate Integration (Monetization)**

* Affiliate\_Insert\_Used: Boolean (Yes / No).  
* Affiliate\_Product: Name of the tool or ingredient (e.g., High-Power Chopper).  
* Affiliate\_Strategy: How the product was shown, based on KB-07 (e.g., Texture Proof, Health Enabler).  
* Affiliate\_Visibility: How prominent the product is (Low, Medium, High).

### **D. Predictive Analytics (AI Estimations)**

* Predicted\_Emotion: The main feeling the video should evoke (e.g., Hungry, Curious, Motivated).  
* Target\_Action: The primary metric this video is optimized for (Save, Share, Click (CTR), Comment).  
* Production\_Complexity: Estimated difficulty for Veo to generate correctly (Easy, Medium, Hard).

## **4\. Mandatory Output Format (JSON Structure)**

At the very end of every complete framework output, the AI MUST provide this data in a valid JSON format enclosed in a code block.

**Example Template:**

{  
  "Video\_ID": "SS-20231027-001",  
  "Content\_Pillar": "Quick Breakfasts",  
  "Hero\_Ingredient": "Oatmeal",  
  "Total\_Duration\_Sec": 40,  
  "Visual\_Style": "C: Food Porn",  
  "Hook\_Type": "Cost Efficiency",  
  "Signature\_Moment": "The Golden Drizzle",  
  "Motion\_Density": "Medium",  
  "Affiliate\_Insert\_Used": "Yes",  
  "Affiliate\_Product": "Pure Honey",  
  "Affiliate\_Strategy": "Texture Proof",  
  "Affiliate\_Visibility": "Medium",  
  "Predicted\_Emotion": "Hungry",  
  "Target\_Action": "Save",  
  "Production\_Complexity": "Medium"  
}  
