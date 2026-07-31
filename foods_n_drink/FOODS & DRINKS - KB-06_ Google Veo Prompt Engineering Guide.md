# **FOODS & DRINKS \- KB-06: GOOGLE VEO PROMPT ENGINEERING GUIDE**

**Project:** Siasat Sehat \- Facebook Reels Production System

**Document Type:** AI Prompt Syntax & Generation Logic

## **1\. Document Function**

This document dictates the exact formula and syntax the AI must use when generating video prompts for Google Veo. Adherence to this structured layering is mandatory to ensure visual consistency, high fidelity, and accurate translation of the Siasat Sehat art direction (from KB-04) into actual video output.

## **2\. The Core Prompt Architecture (The 7 Layers)**

The AI must construct EVERY Google Veo prompt strictly following this sequential layering. Do not alter the order.

* **\[Layer 1: Subject & Core Action\]**  
  * *What is happening? Who/what is the main focus?*  
  * *Example:* Extreme close up of a wooden spoon stirring a thick, vibrant green spinach smoothie in a clear glass.  
* **\[Layer 2: Environment & Prop Context\]**  
  * *Where is it happening, and what surrounds it? (Refer to KB-04)*  
  * *Example:* Sitting on a rustic wooden countertop, subtle blurred kitchen background.  
* **\[Layer 3: Lighting & Atmosphere\]**  
  * *How is the scene lit?*  
  * *Example:* Warm natural morning light streaming from a side window, soft shadows.  
* **\[Layer 4: Camera Angle & Movement\]**  
  * *Where is the camera, and how does it move?*  
  * *Example:* Top-down angle, slow push-in movement.  
* **\[Layer 5: Lens Feeling & Cinematography\]**  
  * *What is the technical style of the shot?*  
  * *Example:* Macro lens, shallow depth of field, sharp focus on the liquid.  
* **\[Layer 6: Visual Modifiers & Quality Enhancers\]**  
  * *Keywords to force Veo to generate high-quality output.*  
  * *Mandatory inclusions:* cinematic, ultra-realistic, highly detailed, 4k resolution, food porn style.  
* **\[Layer 7: Negative Prompts / Exclusions\]**  
  * *What must Veo explicitly AVOID generating?*  
  * *Mandatory exclusions:* \--no text, no watermark, no faces, no human body, no modern luxury kitchen, no messy background, vertical 9:16 aspect ratio.

## **3\. The Assembly Formula (Template)**

When outputting the final prompt in the framework, the AI must combine the layers into a single, cohesive paragraph, separated by commas, ending with the negative parameters.

**Formula:**

\[L1: Subject/Action\]. \[L2: Environment\]. \[L3: Lighting\]. \[L4: Camera\]. \[L5: Lens\]. \[L6: Modifiers\] \[L7: Exclusions\]

## **4\. Examples of Good vs. Bad Prompts**

### **❌ BAD PROMPT (Too vague, lacks direction)**

"A video of someone making a healthy breakfast smoothie on a table. Make it look nice and bright. vertical."

*(Why it's bad: Veo will guess the environment, might include a face, might use weird lighting, and won't focus on the food texture).*

### **✅ GOOD PROMPT (Structured, detailed, strictly follows the architecture)**

"Extreme close up of pouring thick golden honey over a bowl of oatmeal. Rustic wooden table background. Warm morning sunlight, dramatic shadows. Slow push in camera movement. Macro lens, shallow depth of field. Cinematic, food porn style, highly detailed texture, 4k resolution. \--no text, no watermark, no faces, vertical 9:16"

## **5\. Specific Veo Tuning Rules**

* **Motion Control:** If a Signature Moment (from KB-05) is required, the AI must explicitly add slow motion, high frame rate style to Layer 6\.  
* **Affiliate Products:** When generating a prompt for Module D (Affiliate Insert), Layer 1 must clearly prioritize the *action* of the tool (e.g., Close up of a high-power blender rapidly pulverizing ice) rather than just the object itself.