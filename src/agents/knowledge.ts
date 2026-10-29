// src/agents/knowledge.ts

/**
 * Structure for one knowledge base entry.
 */
export interface KnowledgeEntry {
    name: string;             // Canonical symptom name
    aliases: string[];        // Other names people might use
    category: string;         // Grouping category
    generalInfo: string;      // General educational information
    commonCauses: string;     // What commonly causes this
    selfCareInfo: string;     // General self-care suggestions
    seekHelpIf: string;       // When to see a professional
    defaultStep: 'rest' | 'hydrate' | 'see_professional';  // Base recommendation
  }
  
  /**
   * The demo knowledge base.
   *
   * WHY is this a const array?
   * - Easy to read, modify, and test
   * - Can be replaced later with an API call
   * - TypeScript checks the shape of every entry at compile time
   *
   * IMPORTANT: This is NOT a clinically reviewed source.
   * It contains general educational information only.
   */
  export const KNOWLEDGE_BASE: KnowledgeEntry[] = [
    {
      name: 'headache',
      aliases: ['head pain', 'head ache', 'migraine', 'head hurts', 'head is pounding'],
      category: 'neurological',
      generalInfo:
        'Headaches are very common and usually not serious. They can feel like pressure, throbbing, or a dull ache in the head.',
      commonCauses:
        'Common triggers include stress, dehydration, lack of sleep, eye strain, and tension.',
      selfCareInfo:
        'Rest in a quiet, dark room. Stay hydrated. Consider over-the-counter pain relief if appropriate (consult a pharmacist).',
      seekHelpIf:
        'The headache is sudden and extremely severe, comes with confusion, vision changes, stiff neck, or fever.',
      defaultStep: 'rest',
    },
    {
      name: 'fever',
      aliases: ['high temperature', 'temperature', 'feeling hot', 'burning up', 'febrile'],
      category: 'systemic',
      generalInfo:
        'Fever is when your body temperature rises above the normal range (approximately 37°C / 98.6°F). It is usually a sign that your body is fighting an infection.',
      commonCauses:
        'Infections (viral or bacterial), inflammation, heat exhaustion, and sometimes medications.',
      selfCareInfo:
        'Rest and drink plenty of fluids. Light clothing and a comfortable room temperature may help.',
      seekHelpIf:
        'Temperature is above 39.4°C (103°F), lasts more than 3 days, or is accompanied by severe symptoms.',
      defaultStep: 'hydrate',
    },
    {
      name: 'cough',
      aliases: ['coughing', 'dry cough', 'wet cough', 'persistent cough', 'hacking cough'],
      category: 'respiratory',
      generalInfo:
        'Coughing is a reflex that helps clear your airways. It can be dry (no mucus) or productive (with mucus).',
      commonCauses:
        'Common cold, flu, allergies, asthma, post-nasal drip, or irritant exposure.',
      selfCareInfo:
        'Stay hydrated, use honey in warm water (not for children under 1), and rest. Avoid irritants like smoke.',
      seekHelpIf:
        'Cough lasts more than 3 weeks, produces blood, or comes with high fever or difficulty breathing.',
      defaultStep: 'rest',
    },
    {
      name: 'sore throat',
      aliases: ['throat pain', 'sore throat', 'scratchy throat', 'throat hurts', 'painful throat'],
      category: 'ENT',
      generalInfo:
        'A sore throat causes pain, scratchiness, or irritation in the throat that often worsens when swallowing.',
      commonCauses:
        'Viral infections (most common), bacterial infections like strep throat, dry air, allergies, or voice strain.',
      selfCareInfo:
        'Gargle with warm salt water, drink warm fluids, suck on lozenges, and rest your voice.',
      seekHelpIf:
        'Difficulty swallowing or breathing, high fever, rash, or symptoms lasting more than a week.',
      defaultStep: 'rest',
    },
    {
      name: 'fatigue',
      aliases: ['tired', 'tiredness', 'exhaustion', 'exhausted', 'feel tired', 'no energy', 'feeling weak', 'weakness'],
      category: 'systemic',
      generalInfo:
        'Fatigue is an ongoing feeling of tiredness or exhaustion that is not fully relieved by rest.',
      commonCauses:
        'Poor sleep, stress, overwork, dehydration, nutritional deficiencies, or underlying medical conditions.',
      selfCareInfo:
        'Prioritize sleep hygiene, eat balanced meals, stay hydrated, and consider reducing stress.',
      seekHelpIf:
        'Fatigue persists for more than 2 weeks, is severe, or comes with unexplained weight loss or other symptoms.',
      defaultStep: 'rest',
    },
    {
      name: 'nausea',
      aliases: ['nauseous', 'feeling sick', 'queasy', 'feel like vomiting', 'upset stomach'],
      category: 'gastrointestinal',
      generalInfo:
        'Nausea is the uncomfortable sensation of needing to vomit. It may or may not lead to actual vomiting.',
      commonCauses:
        'Food issues, motion sickness, infections, medications, pregnancy, or stress.',
      selfCareInfo:
        'Sip clear fluids slowly, eat bland foods (like crackers or toast), and rest. Avoid strong odors.',
      seekHelpIf:
        'Nausea lasts more than 2 days, you cannot keep fluids down, or you notice blood in vomit.',
      defaultStep: 'hydrate',
    },
    {
      name: 'diarrhea',
      aliases: ['loose stools', 'watery stools', 'frequent bowel movements', 'stomach bug', 'running stomach'],
      category: 'gastrointestinal',
      generalInfo:
        'Diarrhea is loose, watery stools occurring more frequently than usual. It is usually short-lived.',
      commonCauses:
        'Viral or bacterial infections, food intolerance, medications, or stress.',
      selfCareInfo:
        'Drink plenty of fluids to prevent dehydration. Oral rehydration solutions can help. Eat bland foods.',
      seekHelpIf:
        'Diarrhea lasts more than 2 days, is accompanied by high fever, severe pain, or bloody stools.',
      defaultStep: 'hydrate',
    },
    {
      name: 'back pain',
      aliases: ['backache', 'lower back pain', 'upper back pain', 'back ache', 'spine pain'],
      category: 'musculoskeletal',
      generalInfo:
        'Back pain is one of the most common reasons people seek medical help. It can range from a dull ache to sharp, debilitating pain.',
      commonCauses:
        'Muscle strain, poor posture, lifting heavy objects, disc issues, or prolonged sitting.',
      selfCareInfo:
        'Stay gently active (bed rest can worsen it), apply heat or cold, and maintain good posture.',
      seekHelpIf:
        'Pain radiates down a leg, is accompanied by numbness or weakness, or follows an injury.',
      defaultStep: 'rest',
    },
    {
      name: 'runny nose',
      aliases: ['rhinorrhea', 'stuffy nose', 'nasal congestion', 'blocked nose', 'sneezing'],
      category: 'ENT',
      generalInfo:
        'A runny nose occurs when excess fluid drains from the nasal passages. It often accompanies colds or allergies.',
      commonCauses:
        'Common cold, allergies, sinus infections, cold weather, or irritants.',
      selfCareInfo:
        'Use saline nasal spray, stay hydrated, rest, and use a humidifier if air is dry.',
      seekHelpIf:
        'Symptoms last more than 10 days, discharge is green/yellow and accompanied by facial pain or fever.',
      defaultStep: 'rest',
    },
    {
      name: 'dizziness',
      aliases: ['dizzy', 'lightheaded', 'light headed', 'vertigo', 'feeling faint', 'room spinning'],
      category: 'neurological',
      generalInfo:
        'Dizziness is a term describing sensations like feeling faint, unsteady, or as if the room is spinning.',
      commonCauses:
        'Standing up too quickly, dehydration, inner ear issues, low blood sugar, or anxiety.',
      selfCareInfo:
        'Sit or lie down immediately. Drink water. Move slowly when changing positions.',
      seekHelpIf:
        'Dizziness is severe, recurrent, accompanied by fainting, chest pain, or neurological symptoms.',
      defaultStep: 'hydrate',
    },
    {
      name: 'chest pain',
      aliases: ['chest tightness', 'chest discomfort', 'chest pressure', 'pain in chest'],
      category: 'cardiovascular',
      generalInfo:
        'Chest pain can have many causes, from muscle strain to serious heart or lung conditions. It should always be taken seriously.',
      commonCauses:
        'Muscle strain, acid reflux, anxiety, or potentially serious heart or lung conditions.',
      selfCareInfo:
        'New or unexplained chest pain should be evaluated by a healthcare professional promptly.',
      seekHelpIf:
        'Chest pain is severe, sudden, crushing, spreads to arm/jaw, or comes with shortness of breath or sweating.',
      defaultStep: 'see_professional',
    },
    {
      name: 'rash',
      aliases: ['skin rash', 'skin irritation', 'hives', 'itchy skin', 'bumps on skin', 'skin breakout'],
      category: 'dermatological',
      generalInfo:
        'A rash is a change in the color or texture of the skin. Rashes can be itchy, painful, or neither.',
      commonCauses:
        'Allergies, infections, heat, autoimmune conditions, or contact with irritants.',
      selfCareInfo:
        'Avoid scratching. Use gentle, unscented moisturizers. Cool compresses may help itching.',
      seekHelpIf:
        'Rash spreads rapidly, blisters, is accompanied by fever, or appears after starting a new medication.',
      defaultStep: 'rest',
    },
  ];
  
  /**
   * The list of urgent warning signs that the TriageAgent checks.
   *
   * Each entry has:
   * - keywords: phrases that might indicate this condition
   * - sign: the name of the warning sign
   * - explanation: why it's urgent
   *
   * WHY is this a separate constant?
   * So TriageAgent and SafetyAgent can both access the same list,
   * and tests can verify completeness.
   */
  export const URGENT_WARNING_SIGNS = [
    {
      sign: 'Severe or new chest pain',
      keywords: ['chest pain', 'chest tightness', 'chest pressure', 'chest discomfort', 'pain in chest'],
      explanation: 'Chest pain can indicate serious heart or lung conditions requiring immediate evaluation.',
    },
    {
      sign: 'Severe breathing difficulty',
      keywords: ['difficulty breathing', 'can\'t breathe', 'hard to breathe', 'shortness of breath', 'trouble breathing', 'breathing difficulty', 'breathing problem', 'struggling to breathe'],
      explanation: 'Severe difficulty breathing may indicate a life-threatening condition.',
    },
    {
      sign: 'Possible stroke symptoms',
      keywords: ['face drooping', 'arm weakness', 'speech difficulty', 'slurred speech', 'sudden numbness', 'sudden confusion', 'sudden severe headache'],
      explanation: 'Stroke symptoms require emergency treatment — every minute matters.',
    },
    {
      sign: 'Unconsciousness',
      keywords: ['unconscious', 'passed out', 'fainted', 'not responding', 'unresponsive', 'collapsed'],
      explanation: 'Unconsciousness may indicate a serious medical emergency.',
    },
    {
      sign: 'Severe bleeding',
      keywords: ['severe bleeding', 'heavy bleeding', 'won\'t stop bleeding', 'bleeding heavily', 'blood everywhere'],
      explanation: 'Uncontrolled severe bleeding requires immediate medical attention.',
    },
    {
      sign: 'Possible severe allergic reaction',
      keywords: ['anaphylaxis', 'throat swelling', 'tongue swelling', 'can\'t swallow', 'allergic reaction', 'severe allergy', 'swelling up'],
      explanation: 'Severe allergic reactions (anaphylaxis) can be life-threatening.',
    },
    {
      sign: 'Immediate self-harm risk',
      keywords: ['want to die', 'kill myself', 'self harm', 'self-harm', 'suicide', 'suicidal', 'end my life', 'hurt myself'],
      explanation: 'If you or someone you know is in crisis, please contact emergency services (112 in India) or a crisis helpline immediately.',
    },
  ];
  
  /**
   * Quick lookup: given a string, find the matching knowledge entry.
   * Checks both the canonical name and all aliases.
   *
   * WHY is this a function, not built into an agent?
   * Because both the tools (lookup_info) and the ExtractorAgent need it.
   * Keeping it here avoids duplication.
   */
  export function findKnowledgeEntry(symptom: string): KnowledgeEntry | undefined {
    const lower = symptom.toLowerCase().trim();
    return KNOWLEDGE_BASE.find(
      (entry) =>
        entry.name === lower ||
        entry.aliases.some((alias) => alias === lower)
    );
  }