# VISUAL STYLE GUIDE v47.9.1 (Dynamic)

// A reference guide for consistent, high-quality, final-pixel visual aesthetics.
// v47.9.1: Upgraded from v47.9.
// Mandate 1: All citation formatting removed. "Live Report" and "Podcast" styles are confirmed present.
// Mandate 2 (NEW): Added Section IV, the "Dynamic Generation Mandate," to align this file with the AUTEUR and LOCATION guides, resolving the final "static list" conflict.

### I. PURPOSE (REINFORCED FOR FINAL PIXEL)
The purpose of this guide is to establish a coherent and intentional visual identity for all generated assets within a project. The chosen style, selected in the Art Direction step of the workflow, directly informs the artistic_vision and in_camera_effects parameters in the PROMPT_SYSTEM_v47.9.md JSON structure. This protocol is not for inspiration; it is a technical mandate to ensure every aesthetic choice is baked into the prompt to generate final pixel assets that require zero post-production.

### II. THE FINAL PIXEL MANDATE
Post-production is obsolete in this workflow. Every visual characteristic listed below—film grain, color grade, lens flares, atmospheric haze—is not an effect to be added later. It is a fundamental component of the image that must be explicitly commanded in the text prompt. The system is designed to generate a finished product, not raw material.

#### III. STATIC INSPIRATION BANK & KINETIC INTELLIGENCE MAPPING (THE MERGED PROTOCOL)
// This section maps the "Visual Style" to the specific "Camera Movements" (from the 42-Point Library) that maximize its effect.
// MANDATE: When a Style is chosen, the system MUST prioritize the "Signature Movements" defined below.

#### CATEGORY 1: REALIST & AUTHENTIC (UGC/Docu/Surveillance)
// Focus: Raw truth, imperfections, and immediate reality.

1. **"The Honest Review" (UGC/Vlogger)**
   * *Visual Signature:* Ring light reflection in eyes, messy room background, vertical 9:16, bright colors, pop-up text.
   * *Kinetic Intelligence:* **[21] Handheld** (Organic), **[6] Zoom Out** (To show product size), **[7] Crash Zoom** (For emphasis/humor).
   * *Forbidden:* Steadicam, Crane Shot (Too polished).

2. **"Investigative Documentary" (Johnny Harris Style)**
   * *Visual Signature:* Collage animation mixed with gritty realism, high contrast, archival textures.
   * *Kinetic Intelligence:* **[30] Rack Focus** (Evidence to Face), **[24] Shoulder Rig** (On the ground feel), **[35] Whip Pan** (Transition between locations).

3. **"CCTV / Surveillance" (Raw Reality)**
   * *Visual Signature:* High angle, timestamp overlay, low dynamic range, black & white or desaturated, warped corners.
   * *Kinetic Intelligence:* **[1] Pan Left/Right** (Mechanical/Slow Auto-Scan), **[5] Zoom In** (Digital/Pixelated Step-Zoom), **[39] Freeze Frame** (Caught in act).

4. **"Street Interview" (Vox Pop)**
   * *Visual Signature:* Over-the-shoulder shot of reporter, city blur background, bright daylight, uncontrolled environment.
   * *Kinetic Intelligence:* **[21] Handheld** (Reactive), **[35] Whip Pan** (To look at what interviewee points at), **[7] Crash Zoom** (Reaction shot).

5. **"Bodycam / First Responder" (Urgent POV)**
   * *Visual Signature:* Chest-mounted POV, fisheye distortion, chaotic motion blur, high contrast, muffled audio.
   * *Kinetic Intelligence:* **[23] Snorricam** (If looking at face), **[21] Handheld** (Extreme Shake), **[18] Following Shot** (Chasing someone), **[39] Freeze Frame** (Impact moment).

6. **"Dashboard Camera" (Road Witness)**
   * *Visual Signature:* Wide-angle windshield view, reflections, overexposed sky, timestamp, road focus.
   * *Kinetic Intelligence:* **[16] Tracking Shot** (Fixed to car speed), **[11] Crab Shot** (Lane changing feel), **[7] Crash Zoom** (On accident/incident).

7. **"The 'Empty Bottle' Testimonial" (Radical Authenticity)**
   * *Visual Signature:* Harsh sunlight, hard shadows, messy environments (trash bins, drawers), products that look destroyed/used/empty.
   * *Kinetic Intelligence:* **[5] Macro Zoom In** (On the crumpled foil), **[21] Handheld** (Static but shaking with effort), **[30] Rack Focus** (Trash to New Stock).
   * *Mandatory Keywords:* "Crumpled", "Squeezed Flat", "Used Up", "Empty", "Trash Pile", "Restock", "Raw Realism".

#### CATEGORY 2: CINEMATIC & LUXURY (Commercial/High-End)
// Focus: Perfection, controlled lighting, and expensive aesthetics.

8. **"Luxury Commercial" (Skin/Jewelry)**
   * *Visual Signature:* Gold/Warm grading, macro details, fluid liquid simulation, anamorphic lens flares, flawless textures.
   * *Kinetic Intelligence:* **[19] Slider Shot** (Ultra smooth product reveal), **[30] Rack Focus** (Texture to Label), **[13] Orbit Shot** (Hero product moment), **[36] Slow Motion**.

9. **"The Wes Anderson" (Symmetrical/Quirky)**
   * *Visual Signature:* Flat composition, pastel colors, center framing, high-key lighting, 90-degree angles.
   * *Kinetic Intelligence:* **[35] Whip Pan** (Strict 90-degree turns), **[10] Truck Left/Right** (Perfectly parallel), **[39] Freeze Frame**, **[7] Crash Zoom**, **[32] Deep Focus** (Everything sharp).

10. **"Noir / Moody" (Internal Conflict)**
   * *Visual Signature:* Black and white or extreme monochrome, Chiaroscuro lighting (high contrast), silhouettes, rain.
   * *Kinetic Intelligence:* **[8] Slow Dolly In** (Creeping tension), **[3] Roll/Dutch Angle** (Unease), **[30] Rack Focus** (Mystery reveal), **[2] Tilt Up** (From gun/hand to eyes).

11. **"Epic Cinematic" (Movie Trailer)**
    * *Visual Signature:* Wide aspect ratio, teal & orange, atmospheric haze, lens flares, blockbuster scale.
    * *Kinetic Intelligence:* **[15] Crane Shot** (Grand reveal), **[12] Arc Shot** (Hero moment), **[14] Boom Shot** (Sweeping up).

#### CATEGORY 3: HIGH ENERGY & VIRAL (TikTok/Gen Z)
// Focus: Retention, speed, and sensory overload.

12. **"Gen Z Chaos" (Maximalist)**
    * *Visual Signature:* Saturated colors, emoji overlays, rapid cuts, aggressive editing.
    * *Kinetic Intelligence:* **[7] Crash Zoom** (Repeated), **[35] Whip Pan**, **[23] Snorricam** (If character running), **[28] FPV Drone** (Aggressive).

13. **"The Matrix / Tech" (Futuristic)**
    * *Visual Signature:* Green/Blue tint, digital rain, cyber elements, sleek reflections.
    * *Kinetic Intelligence:* **[40] Bullet Time** (Frozen subject, moving camera), **[13] Orbit Shot**, **[41] Glitch/Datamosh** (Transitions), **[20] Vertigo Effect**.

14. **"Sports / Action" (High Octane)**
    * *Visual Signature:* Sweat, high shutter speed, motion blur, telephoto compression.
    * *Kinetic Intelligence:* **[28] FPV Drone**, **[11] Crab Shot** (Following player lateral), **[23] Snorricam** (POV Athlete), **[36] Slow Motion** (Impact moment).

15. **"Music Video" (Stylized Flow)**
    * *Visual Signature:* Artistic color grading, stylized vignettes, neon lights, rhythmic editing.
    * *Kinetic Intelligence:* **[3] Roll** (Spinning world), **[35] Whip Pan**, **[6] Zoom Out** (Reveal dancer/singer), **[38] Hyper-Lapse** (Moving fast through city).

#### CATEGORY 4: ATMOSPHERIC & HORROR (Psychological)
// Focus: Dread, unease, and hidden threats.

16. **"Gothic Horror" (The Haunting)**
    * *Visual Signature:* Decaying architecture, candlelight, thick fog, deep shadows, sickly green-yellow grade.
    * *Kinetic Intelligence:* **[8] Slow Dolly In** (Towards a dark door), **[4] Pedestal Up** (Ghost rising), **[17] Leading Shot** (Backing away from threat).

17. **"Found Footage Horror" (The Tape)**
    * *Visual Signature:* VHS static, glitching artifacts, 1990s camcorder date overlay, night vision green.
    * *Kinetic Intelligence:* **[21] Handheld** (Running/Panic), **[41] Glitch/Datamosh** (Monster appearance), **[6] Zoom Out** (To reveal something behind), **[39] Freeze Frame** (The final scare).

18. **"Panic / Anxiety" (Psychological Thriller)**
    * *Visual Signature:* Underexposed, grainy, claustrophobic shallow depth of field, sweat on brow.
    * *Kinetic Intelligence:* **[23] Snorricam** (Locked to actor's chest), **[20] Vertigo Effect** (Realization of fear/Dolly Zoom), **[3] Dutch Angle** (Chaos/Insanity), **[42] Vortex Shot** (Spinning nightmare).

19. **"Melancholic / Sad" (Soft Drama)**
    * *Visual Signature:* Cool tones, soft diffusion, window light, rain on glass.
    * *Kinetic Intelligence:* **[9] Slow Dolly Out** (Abandonment/Leaving), **[16] Tracking Shot** (Walking alone from side), **[33] Shallow Focus** (Isolation from background).

#### CATEGORY 5: PRODUCT & SPECIALTY
// Focus: Detail, clarity, and instruction.

20. **"Food Porn" (Appetite Appeal)**
    * *Visual Signature:* Steam rising, glistening sauce, warm light, slow drips.
    * *Kinetic Intelligence:* **[36] Slow Motion** (Drizzle/Pour), **[19] Slider Shot**, **[30] Rack Focus** (Front dish to back), **[5] Macro Zoom In**.

21. **"Flat Lay / Tutorial" (Instructional)**
    * *Visual Signature:* Bright white lighting, organized props, clean background.
    * *Kinetic Intelligence:* **[26] Bird's Eye View** (Strict Top-Down), **[37] Time-Lapse** (Process speed up), **[5] Zoom In** (Step detail).

22. **"Fashion / OOTD" (Style)**
    * *Visual Signature:* Full body framing, street background, natural light.
    * *Kinetic Intelligence:* **[4] Pedestal Up/Down** (Scan outfit Shoes to Head), **[13] Orbit Shot**, **[10] Truck** (Walk & turn).

#### CATEGORY 6: RETRO & BROADCAST (Nostalgia/TV)
// Focus: Era-specific looks and TV formats.

23. **"90s Sitcom" (Comfort TV)**
    * *Visual Signature:* 4:3 Aspect Ratio, bright flat lighting, multi-camera setup, soft focus, laugh track feel.
    * *Kinetic Intelligence:* **[1] Pan Left/Right** (Following actor on stage), **[5] Zoom In** (Cheesy dramatic moment), **[39] Freeze Frame** (Intro credits).

24. **"Live Report / News" (Broadcast)**
    * *Visual Signature:* ENG Camera, lower-third graphics, "LIVE" bug, satellite delay feel.
    * *Kinetic Intelligence:* **[24] Shoulder Rig** (Professional stability), **[5] Zoom In** (To show incident in background), **[1] Pan** (Showing the scene).

25. **"Podcast Studio" (Conversation)**
    * *Visual Signature:* Multi-camera, Shure SM7B mic visible, cinematic studio lighting, shallow depth of field.
    * *Kinetic Intelligence:* **[30] Rack Focus** (Speaker A to Speaker B), **[19] Slider Shot** (Slow movement on wide shot), **[8] Dolly In** (Intense statement).

26. **"Vintage Film" (Memory)**
    * *Visual Signature:* 8mm/16mm film grain, light leaks, scratches, muted tones, 18fps jerky motion.
    * *Kinetic Intelligence:* **[21] Handheld** (Home movie feel), **[35] Whip Pan** (Careless camerawork), **[6] Zoom Out** (Landscape reveal).

#### CATEGORY 7: SCALE & WORLD BUILDING (Experimental)
// Focus: Size, immersion, and god-like perspectives.

27. **"God's Eye / Map View" (Strategy)**
    * *Visual Signature:* Extremely high altitude, flat lighting, grid-like composition.
    * *Kinetic Intelligence:* **[27] God’s Eye View** (Static high altitude), **[29] Rocket Shot** (Flying straight up rapidly), **[25] Drone Flyover** (Slow drift).

28. **"Miniature World" (Tilt-Shift)**
    * *Visual Signature:* Blurs top and bottom of frame, high saturation, makes world look like toys.
    * *Kinetic Intelligence:* **[34] Tilt-Shift** (Lens effect), **[37] Time-Lapse** (Cars moving like toys), **[26] Bird's Eye View**.

29. **"Hyperreal 3D / Dreamscape" (Uncanny)**
    * *Visual Signature:* Unreal Engine 5 render, ray tracing, perfect reflections, neon or pastel dream colors.
    * *Kinetic Intelligence:* **[17] Leading Shot** (Floating backwards), **[32] Deep Focus** (Infinite sharpness), **[4] Pedestal** (Floating elevator).

#### CATEGORY 8: AI-SAFE COMMERCIAL ASSETS (Mass Production Optimized)
// Focus: Clean backgrounds, high contrast, low hallucination risk. Optimized for text overlays.

30. **"The Studio Minimalist" (Solid Color)
    * *Visual Signature: Solid pastel or brand-color background (seamless paper), one sharp shadow, hero product in center.
    * *Kinetic Intelligence: [13] Orbit Shot, [19] Slider Shot.
    * *Why Mass Prod? Easiest for AI to maintain consistency. Perfect for overlaying variable text.

31. **"The Green Screen/Alpha" (Mockup Ready)
    * *Visual Signature: High-key white background (RGB 255,255,255), even flat lighting, no depth of field.
    * *Kinetic Intelligence: [13] Orbit Shot (Object rotates on axis).
    * *Why Mass Prod? Allows user to key out the background and place the product in any environment later.

32. **"The Infinite Kitchen/Desk" (Templated Realism)
    * *Visual Signature: A blurry, generic "Modern Kitchen" or "Office Desk" background that looks realistic but lacks distinct landmarks.
    * *Kinetic Intelligence: [5] Zoom In.
    * *Why Mass Prod? Provides "Realism" without the risk of shifting architectural details between clips.

### IV. DYNAMIC GENERATION MANDATE (NEW v47.9.1)
// This protocol activates when the user requests "alternative options" or "something else."
// This protocol is non-negotiable and forbids the system from simply repeating the static list from Section III.

1.  **Protocol Activation:** User requests alternative options.
2.  **Data Retrieval (Mandatory):** The system must retrieve the core strategic data from the workflow:
    * Core Conflict (e.g., "Imposter Syndrome - Pinjam Duit Context")
    * Audience Profile (e.g., "Gen Z Indonesia")
    * Hot Trend (e.g., "Flexing Culture")
3.  **Dynamic Synthesis & Generation:** The system must synthesize this data to invent new, relevant Visual Style options on the fly.
4.  **Presentation:** The system will present these new, dynamically generated options to the user.

#### Execution Example:
* **Data:** Audience = Gen Z Indonesia, Conflict = "Imposter Syndrome (Pinjam Duit Context)".
* **User:** "I don't like these styles. Give me something different."
* **System (Activating Dynamic Protocol):** "Understood. Based on your specific conflict (Gen Z, Flexing, Pinjam Duit), here are three dynamically generated Visual Styles:"
    1.  *"Influencer Clarification Video" Style: Visuals mimic an 'influencer apology/clarification' video. Shot on a phone, low-angle, flat lighting, where the Protagonist nervously explains their finances to the camera.*
    2.  *"CCTV Warteg" Style: A static, high-angle, low-resolution visual. We watch the awkward social interaction between the 'flexing' Protagonist and the 'Skeptic' (old friend) in a cheap, realistic setting.*
    3.  *"Bank Account Screen Record" Style: The entire visual is a screen recording of a mobile banking app. The 'Enemy' is the balance dropping with each 'pinjam duit' transfer, while 'ping' sounds (from the PROMPT_SYSTEM) increase the anxiety.*

### V. THE INFINITE STYLE MATRIX (30 MIX-MATCH VARIATIONS)
// MANDATE: When User says "Creative", randomly combine [A] + [B] + [C] to invent a new look.

**CATEGORY A: TEXTURE & ERA (The "Feel")**
1.  **"VHS Degradation":** Scan lines, color bleeding, magnetic tape noise.
2.  **"16mm Ektachrome":** High grain, warm reds, nostalgic saturation.
3.  **"CCTV Night Vision":** Green/Grey tint, glowing eyes, low resolution.
4.  **"Glossy Editorial":** Phase One sharpness, zero grain, pore-perfect.
5.  **"Wet Plate Collodion":** 1800s vibe, vignetting, unpredictable chemical stains.
6.  **"Risograph Print":** Dithered texture, misaligned CMYK colors.
7.  **"Game Engine Glitch":** Low-poly texture loading, T-pose errors.
8.  **"Thermal Heat Map":** Predator vision, emotional temperature (Red=Anger).
9.  **"Disposable Camera":** Harsh flash, high contrast, overexposed forehead.
10. **"Blueprint/Schematic":** Wireframe overlay, technical measurements.

**CATEGORY B: LIGHTING MOOD (The "Emotion")**
11. **"Giallo Gel":** Deep reds and blues, unnatural shadows (Horror/Thriller).
12. **"Bioluminescent":** Light comes from within plants/objects (Fantasy).
13. **"God Rays (Volumetric)":** Dusty shafts of light in a dark room (Awe).
14. **"Neon Noir":** Wet pavement reflections, pink/cyan spill (Cyberpunk).
15. **"Interrogation Lamp":** Single harsh overhead source, black void (Tension).
16. **"Golden Hour Flare":** Lens totally washed out by sun (Dreamy).
17. **"Aquarium Cast":** Shimmering caustic water reflections on walls (Calm/Drowning).
18. **"Strobe/Flicker":** Lightning storm or broken bulb effect (Panic).
19. **"Softbox Studio":** Perfect wrap-around light (Commercial Trust).
20. **"Silhouette Backlight":** Total darkness subject, bright background (Mystery).

**CATEGORY C: COMPOSITION (The "Eye")**
21. **"Symmetrical Center":** Wes Anderson perfection (Control).
22. **"Extreme Low Angle":** Hero looks like a giant (Dominance).
23. **"Dutch Tilt + Zoom":** Disorientation (Anxiety).
24. **"Spy Long Lens":** Shooting through fence/leaves (Voyeurism).
25. **"Fisheye 180":** Distorted face, nose huge (Playful/Music Video).
26. **"Top-Down Knolling":** Objects organized at 90 degrees (Satisfying).
27. **"Split Diopter":** Foreground and Background both sharp (Duality).
28. **"Reflection Only":** Filming the mirror, not the person (Introspection).
29. **"Body Cam Chest":** Hands visible, immersive movement (Action).
30. **"Drone Vertigo":** Spinning downward spiral (Chaos).

### VI. THE EMOTIONAL COLOR SCRIPT & LUT LIBRARY (30 PSYCHOLOGICAL TRIGGERS)
// MANDATE: Select the Color Palette based strictly on the desired EMOTIONAL RESPONSE of the viewer.

**SET A: ANXIETY, FEAR & SICKNESS (The "Unease" Palettes)**
1.  **"The Fincher Green" (Pale Yellow-Green):** Bureaucracy, sickness, corruption, rot. (Use: Office thrillers, hospitals).
2.  **"The Matrix Tint" (Digital Green):** Unreality, simulation, code, artificiality. (Use: Tech, sci-fi).
3.  **"The Nuclear Fallout" (Desaturated Brown/Grey):** Hopelessness, decay, dust, post-apocalypse. (Use: Dystopian).
4.  **"The Sickly Neon" (Fluorescent Flicker):** Unflattering greenish-white, harsh reality, drug dens, late-night convenience stores.
5.  **"The Void Black" (Crushed Shadows):** Fear of the unknown, isolation, nothingness. High contrast, zero detail in blacks.
6.  **"The Bruise Palette" (Purple/Yellow/Black):** Physical pain, abuse, aftermath of violence.
7.  **"The Fever Dream" (Oversaturated/Blurry):** Disorientation, heat stroke, hallucination, intoxication.
8.  **"The Cold Steel" (Metallic Blue/Grey):** Institutional cruelty, prisons, spaceships, lack of empathy.
9.  **"The Blood Wash" (Deep Red Overlay):** Immediate danger, alarm, violence, rage (Carrie style).
10. **"The Urine Filter" (Heavy Yellow Sepia):** Heat, sweat, grime, poverty, Mexico (Hollywood trope style).

**SET B: NOSTALGIA, LOVE & WARMTH (The "Comfort" Palettes)**
11. **"The Golden Hour" (Soft Amber/Gold):** Romance, hope, new beginnings, magic hour.
12. **"The Kodachrome" (Vibrant Red/Yellow/Blue):** 1950s/60s nostalgia, family vacation, american dream, saturated optimism.
13. **"The Sepia Memory" (Faded Brown):** The distant past, history, forgotten memories, dusty photo albums.
14. **"The Pastel Dream" (Wes Anderson Pink/Blue):** Whimsy, innocence, childhood, structured artificiality.
15. **"The Candlelight" (Deep Orange/Black):** Intimacy, secrets, warmth in the darkness, primitive safety.
16. **"The Polaroid Fade" (Washed out Blacks/Creamy Whites):** Hipster nostalgia, indie vibes, fleeting moments.
17. **"The Hearth" (Firelight Glow):** Safety from the storm, family gathering, storytelling.
18. **"The Spring Bloom" (Fresh Green/Pink):** Rebirth, growth, easter colors, soft lighting.
19. **"The Royal Velvet" (Deep Purple/Gold):** Wealth, luxury, power, royalty, ancient mystery.
20. **"The Ethereal White" (High Key/Bloom):** Heaven, near-death experience, purity, overexposed bliss.

**SET C: ACTION, TENSION & MODERNITY (The "Stimulant" Palettes)**
21. **"The Blockbuster Teal & Orange" (Complementary):** Maximum visual separation. Skin pops against blue background. Action, energy.
22. **"The Cyberpunk Neon" (Pink/Cyan/Black):** Future tech, night life, high stimulation, artificial intelligence.
23. **"The Industrial Blue" (Steel/Cyan):** Cold efficiency, spy thrillers, modern warfare, technology.
24. **"The High-Contrast B&W" (Noir):** Moral ambiguity, sharp lines, detective stories, graphic novel style.
25. **"The Acid Trip" (RGB Split/Rainbow):** Chaos, partying, mental breakdown, sensory overload.
26. **"The Night Vision" (Monochrome Green/Grain):** Surveillance, stalking, military ops, found footage.
27. **"The Vaporwave" (Soft Pink/Purple):** Retro-future, 80s nostalgia, consumerism, mall aesthetics.
28. **"The Desert Bleach" (Desaturated/High Brightness):** Thirst, exposure, isolation, raw survival (Mad Max style).
29. **"The Corporate Clean" (Sterile White/Blue):** Apple store aesthetic, futurism, cleanliness, lack of secrets.
30. **"The Danger Zone" (Yellow/Black):** Warning signs, biohazard, construction, caution, industrial accidents.

### VII. THE ADVANCED LIGHTING GEOMETRY MATRIX (30 SHAPES OF LIGHT)
// MANDATE: Define the SHAPE of the shadow, not just the brightness.

**SET A: PORTRAIT GEOMETRY (The Face)**
1.  **"Rembrandt Triangle":** Key light 45 degrees. Triangle of light on the shadow cheek. Classic, dramatic, cinematic.
2.  **"Split / Terminator":** Light from 90 degrees side. Half face lit, half black. Duality, secret villain.
3.  **"Butterfly / Paramount":** Light from top-center. Shadow under nose. Glamour, beauty, feminine power.
4.  **"Badger / Top-Down":** Light directly above. Eyes in shadow (Skull eyes). Evil, mysterious, anonymous.
5.  **"Monster / Up-Lighting":** Light from below chin. Unnatural shadows going up. Horror, campfire ghost story.
6.  **"Rim / Edge Only":** No front light. Only silhouette outline. Mystery, anonymity, form over detail.
7.  **"Checkerboard":** Background lit opposite to foreground (Light face on dark wall, Dark side on light wall). Depth.
8.  **"Broad Lighting":** Lit side of face is closest to camera. Makes face wider. Openness, honesty.
9.  **"Short Lighting":** Shadow side of face is closest to camera. Slimming, dramatic, hiding something.
10. **"Ring Light / Catchlight":** Circular reflection in eyes. Modern, influencer, artificial beauty.

**SET B: SHADOW TEXTURE (The Gobo/Cookie)**
11. **"Venetian Blinds":** Horizontal slats of shadow across face. Film Noir, entrapment, waiting.
12. **"Tree Dapple (Komorebi)":** Random organic leaf shadows. Nature, peace, softness.
13. **"Prison Bars":** Vertical hard shadows. Trapped, guilty, caged.
14. **"Water Caustics":** Moving, rippling light reflections. Underwater, drowning, dream state.
15. **"Fan Blade Chop":** Rhythmic strobing shadow. Tension, industrial, helicopter overhead.
16. **"Window Pane (Crucifix)":** Cross-shape shadow. Religious, burden, sacrifice.
17. **"Lace Curtain":** Intricate floral shadow pattern. Nostalgia, grandmother's house, dusty memories.
18. **"Rain Streaks":** Shadows of rain running down glass. Melancholy, isolation.
19. **"Chainlink Fence":** Diamond pattern shadow. Urban grit, trapped outside.
20. **"Abstract Hard Shapes":** Sharp geometric shadows (Architecture). Modernism, coldness, order.

**SET C: ATMOSPHERIC VOLUME (The Air)**
21. **"God Rays (Volumetric)":** Distinct shafts of light in dust/smoke. Awe, church, discovery.
22. **"Silhouette Haze":** Backlit fog showing shape but no detail. Mystery, arrival of the unknown.
23. **"Glow / Bloom":** Light spilling over edges of objects. Heat, dream, memory, heaven.
24. **"Negative Fill":** Using black flags to deepen shadows (Anti-bounce). High contrast drama, moody.
25. **"Book Light":** Light bounced then diffused. Extremely soft wrapping light. Gentle, maternal, safe.
26. **"Practical Motivated":** Light coming only from visible lamps/candles. Realism, immersion.
27. **"TV Flicker":** Blueish intermittent glow. Insomnia, hypnosis, loneliness.
28. **"Police Siren Wash":** Rotating Red/Blue wash. Crime scene, panic, arrest.
29. **"Firelight Pulse":** Random warm orange pulsing. Primitive, survival, danger.
30. **"Projector Beam":** Dusty cone of light with flickering images. Cinema, interrogation, exposing truth.

### VIII. THE VERTICAL & GRID COMPOSITION MATRIX (30 FRAMING LAWS)
// MANDATE: Re-engineer Hollywood composition rules for the 9:16 VERTICAL CANVAS.
// PROBLEM: Standard "Rule of Thirds" often decapitates subjects in vertical video.

**SET A: VERTICAL FRAMING PHYSICS (9:16 Rules)**
1.  **"The Tower Composition":** Stack visual elements vertically (Sky top, Face mid, Hands bottom). Leading lines go UP/DOWN, not left/right.
2.  **"The Extreme Headroom":** Subject at bottom 1/3, massive empty space above. (Isolation/oppression).
3.  **"The No-Headroom Crop":** Forehead cut off, focus on eyes/mouth. (Intimacy/Intensity/TikTok style).
4.  **"The Split-Screen Vertical":** Top half shows reaction, bottom half shows action. (Duality).
5.  **"The Corridor Depth":** Use hallways/alleys to create deep Z-axis depth in the narrow frame.
6.  **"The Portrait 50/50":** Face centered exactly in the middle. Symmetrical. (Wes Anderson Vertical).
7.  **"The Floor-Up Hero":** Camera on ground looking up. Subject fills the vertical height perfectly. (Dominance).
8.  **"The Ceiling-Down God":** Camera on ceiling looking down. Subject creates a shape on the floor. (Vulnerability).
9.  **"The Selfie Orbit":** Camera moves around subject at arm's length. Background spins. (Disorientation).
10. **"The Product Pedestal":** Product takes up bottom 50%, negative space top 50% for text. (Commercial).

**SET B: GRID & MATRIX NARRATIVE (Mandate 68 Logic)**
// How to tell a story when using the "Matrix/Strip" layout (3-Panel / 9-Panel).
11. **"The Temporal Strip":** Panel 1 (Past/B&W) -> Panel 2 (Present/Color) -> Panel 3 (Future/Hyper-real).
12. **"The Reaction Loop":** Center panel is the Hero reacting. Surrounding panels are the Chaos causing it.
13. **"The Macro Mosaic":** 9 Panels showing extreme close-ups of *one* object (Eye, Lip, Finger, Texture).
14. **"The Chaos Grid":** Every panel runs a slightly different unsynced loop. (Overwhelm/Anxiety).
15. **"The Sequential Flow":** An object thrown from Top Panel falls into Middle Panel then Bottom Panel.
16. **"The Dialogue Split":** Left Panel (Person A) vs Right Panel (Person B). Facing each other.
17. **"The X-Ray Grid":** Left Panel (Exterior Product) vs Right Panel (Interior Ingredients).
18. **"The Color Gradient":** Top panels are Blue, fading to Red in bottom panels. (Emotional shift).
19. **"The Focus Hunt":** Only 1 panel is sharp at a time. Focus jumps from panel to panel. (Searching).
20. **"The Breaking Borders":** Subject steps out of Panel A and enters Panel B physically. (Breaking the 4th wall).

**SET C: SOCIAL MEDIA ERGONOMICS (UI Safe Zones)**
21. **"The Thumb Zone Avoidance":** Critical action happens in center-middle, avoiding bottom-right (Like button) and bottom (Caption).
22. **"The Hook Center":** The most shocking visual element is dead center to catch the eye instantly.
23. **"The Text-Space Reserve":** Deliberate negative space (Sky/Wall) left empty for overlay text.
24. **"The Eye-Contact Lock":** Subject's eyes positioned at the exact top 1/3 line (Natural eye level).
25. **"The Product Hand-Off":** Hand brings product from bottom-center (viewer's perspective).
26. **"The Swipe Mimicry":** Movement goes Up-to-Down or Down-to-Up to mimic scrolling behavior.
27. **"The Loop Connector":** End frame matches Start frame compositionally for infinite looping.
28. **"The Comment Bait":** Deliberate "mistake" or detail placed in background to trigger comments.
29. **"The Subtitle Space":** Lower 1/3 kept dark/blur to make white subtitles readable.
30. **"The Profile Picture Frame":** Action avoids top-right corner where UI elements usually sit.

### IX. THE OPTICAL LENS & CAMERA MATRIX (CODE: [MATRIX 9.0])
// PURPOSE: Defines the hardware and optical physics (Called by 'cinematography_&_grip').

* **[MATRIX 9.10] 'The Arri Alexa Mini LF'** (Sensor)
  * *Visual:* Large format sensor, smooth highlight rolloff, cinematic depth. Standard for high-end ads.
* **[MATRIX 9.12] 'The Halation / Film Bloom'** (Optic)
  * *Visual:* Reddish-orange glow around bright highlights. Mimics Kodak Vision3 film stock.
* **[MATRIX 9.15] 'Dust Motes & Air'** (Atmosphere)
  * *Visual:* Suspended particles visible in light shafts. Adds "thick air" texture.
* **[MATRIX 9.17] 'The Uncomfortable 14mm'** (Lens)
  * *Visual:* Wide angle distortion. Center bulges slightly. Creates uneasy/weird feeling.
* **[MATRIX 9.18] 'The Clinical Macro (100mm)'** (Lens)
  * *Visual:* Extreme close-up. Depth of field is razor thin (only 2mm in focus). Background creates creamy bokeh. Use for Pores/Product.

### X. THE MICRO-ACTING MATRIX (CODE: [MATRIX X])
// PURPOSE: Defines specific facial muscle movements (Called by 'micro_acting').

* **[MATRIX X-1] 'The Thousand Yard Stare'**
  * *Desc:* Eyes wide, pupils dilated, blinking rate near zero. Looking *through* the camera, not *at* it. (Dissociation).
* **[MATRIX X-5] 'The Lip Quiver'**
  * *Desc:* Subtle vibration of the bottom lip. Pre-crying signal.
* **[MATRIX X-9] 'The Dopamine Dilations'**
  * *Desc:* Pupils expanding rapidly when seeing the product.

### XI. THE WARDROBE SIGNALING MATRIX (CODE: [MATRIX XI])
// PURPOSE: Defines clothing as storytelling (Called by 'wardrobe_signaling').

* **[MATRIX XI-11] 'The Depression Hoodie'**
  * *Desc:* Oversized, heavy grey/black fabric. Swallow the wearer. Hood up.
* **[MATRIX XI-15] 'The Power Blazer'**
  * *Desc:* Sharp shoulders, high contrast color. Signifies confidence/transformation.

### XII. THE TABLETOP PHYSICS ENGINE (CODE: [MATRIX 12.0])
// PURPOSE: Defines liquid and object interaction physics (Crucial for Metaphor Mode).

* **[MATRIX 12.1] 'The Melt Dynamics'**
  * *Visual:* Solid turning to liquid instantly. High viscosity. Heat distortion waves. (Fat burning metaphor).
* **[MATRIX 12.2] 'The Absorption Speed'**
  * *Visual:* Liquid touching a porous surface and vanishing inside <0.2s. Surface blooms. (Sponge metaphor).
* **[MATRIX 12.3] 'The Emulsification'**
  * *Visual:* Oil meeting water/agent and exploding into micro-droplets (Milky cloud). (Cleaning metaphor).
* **[MATRIX 12.4] 'The Surface Tension Break'**
  * *Visual:* Water beading up (Hydrophobic) vs. Water flattening out (Hydrophilic).

### XIII. THE METAPHORIC ACTING KEY PHRASES (CODE: [MATRIX XIII])
// PURPOSE: Defines the "micro_acting_key_phrase" for I2V/T2V prompts to ensure artistic physics.

* **[MATRIX 13.1] 'The Elastic Strain'**
  * *Visual:* Object expanding against resistance (cage/wire). Focus on surface tension, bulging, and stress wrinkles before popping.
* **[MATRIX 13.2] 'The Viscous Invasion'**
  * *Visual:* Thick liquid slowly coating a solid object. Focus on flow dynamics, drips, and complete coverage (no splashes).
* **[MATRIX 13.3] 'The Desiccated Fracture'**
  * *Visual:* Rapid drying and cracking of a surface. Focus on the geometry of the cracks (spiderweb) and dust particles.
* **[MATRIX 13.4] 'The Molecular Dissolve'**
  * *Visual:* Solid matter turning into effervescent bubbles or liquid upon contact with an agent.
* **[MATRIX 13.5] 'The Celestial Impact'**
  * *Visual:* An object landing with such force it creates a shockwave of particles (dust/gold/water) that clears the air.

### XIV. THE CAMERA LOGIC GATE (MANDATE 86 SOURCE)
// PURPOSE: To enforce variable camera selection based on Creative Direction (Anti-Repetition Protocol).
// REFERENCE: Connected to PROMPT_SYSTEM > Mandate 86.
// LOCATION: This is the FINAL section of the Visual Style Guide.

**LOGIC BLOCK A: COMMERCIAL & HIGH FIDELITY**
* **Trigger Input:** "Commercial", "Luxury", "Product Showcase", "Cinematic Macro", "High End".
* **HARD LOCK:** [MATRIX 9.10] 'Phase One XF IQ4 (150MP)' + 'Rodenstock 100mm Macro'.
* **Visual Reason:** Maximum resolution (150MP) required for texture details, liquid physics, and "Expensive" look.

**LOGIC BLOCK B: AUTHENTIC & RELATABLE (UGC)**
* **Trigger Input:** "UGC", "Vlog", "Honest Review", "Daily Life", "POV", "TikTok Style".
* **HARD LOCK:** [MATRIX 9.14] 'Sony A7S III' + '24mm Wide G-Master' -OR- [MATRIX 9.16] 'iPhone 15 Pro Max'.
* **Visual Reason:** Relatability requires "Imperfect" digital noise, deep depth of field, and wider angles to simulate consumer reality.

**LOGIC BLOCK C: NARRATIVE & EMOTIONAL**
* **Trigger Input:** "Cinematic", "Drama", "Storytelling", "Short Film", "Soft Sell", "Parenting".
* **HARD LOCK:** [MATRIX 9.2] 'Arri Alexa Mini LF' + 'Cooke S4/i Prime (50mm)'.
* **Visual Reason:** Organic skin tone rendering (Science of Color) and soft highlight rolloff for human emotion/faces.

**LOGIC BLOCK D: RAW & DOCUMENTARY**
* **Trigger Input:** "Raw", "Street", "Documentary", "Gritty", "News", "Investigative".
* **HARD LOCK:** [MATRIX 9.15] 'Blackmagic Pocket 6K Pro' + 'Handheld Rig'.
* **Visual Reason:** High dynamic range but unpolished, "Run and Gun" texture, slightly shaky friction.