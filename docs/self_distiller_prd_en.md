# Self Distiller PRD

Version: v0.1  
Purpose: Product requirements document for a coding agent or development team  
Product type: Web App + Agent Framework  
Core goal: Build a continuously evolving personal Self Model by importing existing user materials, conducting role-based interviews, running blind calibration tests, and collecting real task feedback. The system learns how the user expresses themselves, makes decisions, and interacts across different languages, roles, relationships, and contexts.

---

## 1. One-Sentence Product Description

Self Distiller is a multilingual, multi-role, multi-context personal expression modeling system. It learns from a user's historical materials, role-based interviews, blind calibration tests, and real task feedback to build an evolving Self Model that can be used by agents for chat replies, work communication, content creation, course scripts, sales copy, and personal decision support.

---

## 2. Background

The user wants to create an agent that can understand them deeply over time and gradually produce a distilled version of “the user.”

This “user model” is not a fixed personality profile or a simple persona prompt. It is a dynamic Self Model.

The system should:

- Import existing materials to avoid starting from zero.
- Use interviews as a concentrated method for collecting user information.
- Capture the user’s tone, reaction style, correction style, and interaction behavior during interviews.
- Allow interview agents to use different identities, tones, and roles to elicit different aspects of the user.
- Let users define their own languages, roles, relationships, and scenarios.
- Distinguish between the user at work, in private life, with close friends, with family, as a boss, as a subordinate, as a parent, and so on.
- Distinguish between how the user communicates in Chinese, English, Swedish, or other languages.
- Capture changes over time, including language improvement, role changes, relationship changes, and evolving expression patterns.
- Use blind calibration: the agent first generates a hidden reply, then the user writes their own reply, and the system compares the two to correct the model.
- Eventually, in appropriate and authorized contexts, generate replies that are so close to the user’s real way of speaking that a close friend would not easily notice the difference.

---

## 3. Product Positioning

Self Distiller is not a normal chatbot.

It is also not simply:

- A second brain
- A digital avatar
- A digital human
- A writing assistant
- A prompt manager
- A single persona skill

A more accurate positioning is:

> A Self Agent system that builds a personal expression model through active sampling and continuous calibration.

The core asset is not the agent itself.  
The core asset is the Self Model.

The agent is only the execution layer that calls the Self Model. The Self Model is the long-term, exportable, evolving, reusable user asset.

---

## 4. Core Principles

### 4.1 Do Not Generate One Fixed “Self”

A user is not one single persona.

The system must support:

- The user in different languages
- The user in different roles
- The user in different relationships
- The user in different scenarios
- The user across different time periods

Examples:

- Chinese + close friend + casual chat
- Chinese + boss + subordinate delay feedback
- English + work email + client communication
- Swedish + friend chat + light grammar mistakes
- Swedish + formal email + higher correction level
- Chinese + mother + comforting a child
- Chinese + younger sister + complaining to an older sister

The system must use a Context Router to select the correct expression model.

---

### 4.2 Interviews Are a Core Data Collection Method

Interviews are not a secondary feature. They are an active sampling engine.

Their value includes:

1. Directly collecting user facts, preferences, memories, and background.
2. Capturing how the user speaks, reacts, corrects, hesitates, pushes back, and structures their thoughts.
3. Using different interviewer identities to elicit different user behaviors.
4. Simulating different scenarios to collect role-specific and relationship-specific behavior.
5. Using pressure, challenge, warmth, formality, casualness, or intimacy to observe how the user responds.

Interviews should not only ask:

> What kind of person are you?

They should simulate actual interaction:

> I am your subordinate. I messed up the project, but I also feel it was not entirely my fault. What would you say to me?

Or:

> I am your close friend. I say: “I feel really exhausted lately and don’t want to do anything.” How would you reply?

Interviews must capture both:

- What the user says
- How the user says it

---

### 4.3 Imported Materials Are for Cold Start

Existing user materials are extremely important.

The system should support importing:

- Previous copywriting
- Chat records
- ChatGPT conversation records
- Emails
- Social media posts
- Video scripts
- Course scripts
- Diaries
- Notion / Obsidian documents
- Product descriptions
- Sales replies
- Customer replies
- Personal bio / resume

Imported materials are used to generate Self Model v0.1 quickly.

However, imported materials must not be merged blindly.  
Each item must be classified and tagged by source, time, language, context, confidence, and reliability.

---

### 4.4 Blind Calibration Is a Key Training Mechanism

Most persona systems ask the user to rate whether a response “sounds like me.”

Self Distiller uses a stronger calibration mechanism:

1. The system presents a scenario or incoming message.
2. The agent generates a reply, but keeps it hidden.
3. The user writes their own real reply.
4. The system reveals the agent reply and the user reply side by side.
5. The system compares the differences.
6. The system proposes a model update.
7. The user accepts, rejects, edits, or partially accepts the update.
8. The model is versioned.

This mechanism is called Blind Self Calibration.

It prevents the user from being influenced by the agent’s answer and produces cleaner real user samples.

---

### 4.5 Evolution Must Be Controlled, Traceable, and Reversible

The Self Model must not drift automatically without control.

Every update must keep:

- Source evidence
- Timestamp
- Affected scope
- Confidence level
- Applicable context
- Whether it is a long-term pattern
- Whether it is a temporary state
- Whether more evidence is needed
- Previous version

One answer must not rewrite the user’s core personality.

For example, if the user is irritated today and writes aggressively, the system must not immediately conclude that the user is generally aggressive.

It should mark:

- Current state: possibly irritated
- Long-term pattern: insufficient evidence
- Needs further observation

---

## 5. Target Users

### 5.1 Initial Target Users

The first version should target:

1. Content creators  
   People who frequently write copy, video scripts, course content, or social media posts.

2. Teachers / course creators  
   People who need a consistent teaching voice.

3. Founders / small business owners  
   People who communicate with clients, employees, collaborators, and customers.

4. Multilingual users  
   People who communicate differently in Chinese, English, Swedish, or other languages.

5. People who want a personal AI expression model  
   Users who want AI to sound like them rather than like a generic assistant.

---

### 5.2 Non-Initial Target Users

The MVP should not prioritize:

- Enterprise-scale knowledge management
- Customer service bot replacement
- Voice cloning
- Public digital human livestreaming
- Unsupervised automatic chatting on behalf of the user
- High-risk professional advice in legal, medical, or financial contexts

---

## 6. Core Use Cases

### 6.1 Import Historical Materials to Generate an Initial Self Model

The user uploads or pastes historical materials.

The system analyzes:

- Language
- Material type
- Scenario
- Relationship context
- Expression style
- Emotional pattern
- Decision pattern
- Role signals
- Time-based changes
- Supporting evidence

The system outputs Self Model v0.1.

---

### 6.2 Use Interviews to Collect User Information

The user selects a collection target:

- Close friend chat
- Work communication
- Boss role
- Parent role
- Swedish expression
- Content creation
- Sales communication
- Intimate relationship
- Conflict handling

The system generates an interview session.

The interviewer agent can switch identities:

- Close friend
- Product coach
- Skeptical interviewer
- Subordinate
- Child
- Customer
- Student
- Partner
- Stranger interviewer
- Formal interviewer
- Future version of the user

After the interview, the system generates an Interview Extraction Report.

---

### 6.3 Add Languages, Roles, Relationships, and Scenarios

Users can configure a Context Matrix.

Examples:

Languages:

- Chinese
- English
- Swedish

Roles:

- Mother
- Father
- Older sister
- Younger sister
- Boss
- Subordinate
- Teacher
- Student
- Creator
- Seller
- Friend
- Partner

Relationships:

- Close friend A
- Close friend B
- Client
- Subordinate
- Boss
- Child
- Family member
- Student
- Partner
- Stranger

Scenarios:

- Casual chat
- Comforting someone
- Complaining
- Refusing a request
- Conflict handling
- Work assignment
- Giving feedback
- Sales conversion
- Course explanation
- Video script writing
- Formal email
- Swedish daily-life conversation

These dimensions must be composable.

---

### 6.4 Blind Calibration

The system presents a scenario:

```text
Language: Chinese
Role: Boss
Target: Subordinate
Scenario: The subordinate delayed a project and did not mention it in advance.
Incoming message:
“Sorry, I probably can’t deliver this today. I’ll send it tomorrow.”
```

Process:

1. The agent generates a reply but does not show it.
2. The user writes what they would actually reply.
3. The system reveals both replies.
4. The system extracts the differences.
5. The system updates the Work/Boss Model.

Example differences:

- The agent was too gentle.
- The user was more direct.
- The user asked for a specific time first.
- The user explicitly pointed out the communication issue.
- The user did not comfort the other person.
- The user used short sentences.
- The user avoided over-explaining.

Model update:

```text
In the context of “boss + subordinate delay + no prior notice,” the user tends to:
- Ask for a specific delivery time first
- Directly point out the communication problem
- State future expectations clearly
- Avoid excessive comforting language
- Use a direct but non-insulting tone
```

---

### 6.5 Real Task Feedback

The user uses the model to generate:

- Message replies
- Copywriting
- Video scripts
- Course structures
- Emails
- Customer communication
- Swedish replies

The user can label the output:

- Sounds like me
- Does not sound like me
- Too long
- Too short
- Too soft
- Too harsh
- Too AI-like
- Language is too perfect
- Swedish mistakes are preserved too much
- Swedish is corrected too much
- Wrong relationship tone
- Wrong emotional tone
- Wrong intention

The system generates an update proposal from the feedback.

---

## 7. Core Product Modules

```text
Self Distiller
│
├── Import Layer
│
├── Interview Studio
│   ├── daily interview
│   ├── role interview
│   ├── language interview
│   ├── relationship interview
│   ├── stress interview
│   ├── conflict interview
│   └── creative interview
│
├── Interviewer Personas
│   ├── friend interviewer
│   ├── product coach interviewer
│   ├── skeptical interviewer
│   ├── subordinate interviewer
│   ├── child interviewer
│   ├── customer interviewer
│   ├── formal interviewer
│   └── future-self interviewer
│
├── Context Builder
│   ├── languages
│   ├── roles
│   ├── relationships
│   └── scenes
│
├── Evidence Store
│   ├── raw materials
│   ├── explicit answers
│   ├── tone patterns
│   ├── reaction patterns
│   ├── language patterns
│   ├── role-specific behavior
│   └── source metadata
│
├── Self Model
│   ├── core self
│   ├── role models
│   ├── relationship models
│   ├── language models
│   ├── scene models
│   └── time-based evolution
│
├── Blind Calibration Engine
│   ├── hidden agent answer
│   ├── user answer capture
│   ├── comparison
│   ├── difference extraction
│   ├── update proposal
│   └── confidence adjustment
│
├── Persona Router
│   ├── detects context
│   ├── selects identity mode
│   ├── selects language mode
│   ├── selects polish level
│   └── detects sensitive cases
│
├── Output Agents
│   ├── chat reply
│   ├── writing
│   ├── work communication
│   ├── course creation
│   ├── sales
│   └── decision support
│
└── Evolution Engine
    ├── evaluate likeness
    ├── evaluate usefulness
    ├── detect drift
    ├── update local model
    ├── preserve old versions
    └── rollback
```

---

## 8. MVP Scope

### 8.1 MVP Goal

The MVP should not attempt to build the full SelfOS.

The MVP should validate one core loop:

> Can the system use imported materials, role-based interviews, and blind calibration to make the agent’s second-round replies noticeably more like the user than its first-round replies?

---

### 8.2 MVP Main Path

Recommended MVP main path:

```text
Chinese + close friend chat + casual / comforting / complaining / advice
```

Reasons:

- It is closest to the long-term goal.
- Whether the output sounds like the user is easy to judge.
- The user value is immediate.
- It tests language, relationship, tone, emotion, and context.

Optional second path:

```text
Chinese + work identity + subordinate / client communication
```

---

### 8.3 MVP Feature List

Must have:

1. User registration / login
2. Create personal project
3. Add language
4. Add role
5. Add relationship
6. Add scenario
7. Import text materials
8. Classify materials
9. Generate initial Self Model
10. Role-based interview
11. Interview Extraction Report
12. Blind calibration flow
13. Comparison report
14. Model update proposal
15. User approval for updates
16. Version history
17. Generate reply draft from model
18. User feedback: “sounds like me / does not sound like me”
19. Export Self Model as Markdown

Do not build in MVP:

- Automatic WeChat / WhatsApp / Telegram import
- Automatic message sending
- Voice
- Image understanding
- Multi-user collaboration
- Payment system
- Enterprise admin
- Fully automatic proxy chat
- Browser extension
- Native mobile app

---

## 9. User Flows

### 9.1 Onboarding

#### Step 1: Create Self Project

User inputs:

- Project name
- Main goal

Example goals:

- Make the agent reply to close friends like me
- Make the agent write copy in my style
- Make the agent learn my work communication style
- Make the agent learn my Chinese, English, and Swedish expression styles

---

#### Step 2: Choose the First Training Context

Do not ask the user to configure everything at the beginning.

Ask only:

```text
Which context do you want to train first?
```

Options:

- Chatting with close friends
- Work communication
- Copywriting
- Course expression
- Sales replies
- Swedish daily communication
- Custom

---

#### Step 3: Add Context

If the user selects “chatting with close friends,” ask:

- What is the main language?
- Is this for one specific friend or a type of close friend?
- In this context, should the agent sound like the real you or a more polished version of you?
- Should typos, short sentences, filler words, emojis, and casual tone be preserved?
- Should sensitive topics force the agent to stop and ask the user to take over?

---

#### Step 4: Import Materials

The user can paste or upload:

- 10-30 chat samples
- Previous written content
- ChatGPT conversation excerpts
- Manual descriptions

MVP v1 can support only text paste and `.txt` / `.md` uploads.

---

#### Step 5: Generate Self Model v0.1

The system outputs:

- Core Self Summary
- Context Model
- Voice Pattern
- Relationship Pattern
- Language Pattern
- Boundaries
- Unknowns
- Suggested Interviews

---

### 9.2 Interview Flow

User enters Interview Studio.

The system selects an interview type based on the current training target.

Interview types:

1. Information interview  
   Collect facts, preferences, background.

2. Role interview  
   Collect how the user behaves in a specific role.

3. Relationship interview  
   Collect how the user communicates with a certain type of person.

4. Language interview  
   Collect expression patterns in different languages.

5. Conflict interview  
   Collect how the user pushes back, refuses, or handles frustration.

6. Stress interview  
   Collect how the user explains, compresses, defends, or revises thoughts under pressure.

7. Creative interview  
   Collect how the user forms ideas, tells stories, and explains products.

After each interview, generate an Interview Extraction Report.

---

### 9.3 Blind Calibration Flow

Blind Calibration process:

1. The system generates a test message or scenario.
2. The agent generates a hidden answer.
3. The user writes their real answer.
4. The system reveals the comparison.
5. The system generates a Difference Report.
6. The system proposes a model update.
7. The user chooses:
   - Accept
   - Partially accept
   - Reject
   - Edit the update manually
8. The system saves a new version.

---

### 9.4 Output Flow

User enters a real task:

```text
Help me reply to this friend:
“I really feel like a failure lately. Nothing is going well.”
```

User selects Context:

- Language: Chinese
- Role: Friend
- Relationship: Close friend
- Scenario: Comforting
- Mode: Draft Mode

The system generates a reply draft.

The user can provide feedback:

- Sounds like me
- Does not sound like me
- Edit
- Save as training sample

---

## 10. Information Architecture

### 10.1 Main Navigation

```text
Dashboard
Import
Interview Studio
Calibration
Self Model
Contexts
Tasks
Versions
Settings
```

---

### 10.2 Dashboard

Show:

- Current Self Model version
- Number of trained languages
- Number of trained roles
- Number of trained relationships
- Number of imported materials
- Number of completed interviews
- Number of completed blind calibrations
- Recent model changes
- Next recommended task

---

### 10.3 Import

Features:

- Paste text
- Upload `.txt` / `.md`
- Select material type
- Select language
- Select source
- Select relationship or scenario
- Auto-classify
- Preview extracted results

Material types:

- chat
- copywriting
- email
- social_post
- diary
- course_script
- product_text
- sales_reply
- chatgpt_conversation
- other

---

### 10.4 Interview Studio

Features:

- Select interview target
- Select interviewer persona
- Select language, role, relationship, scenario
- Start interview
- Save raw transcript
- Generate Interview Extraction Report
- Propose model updates

---

### 10.5 Calibration

Features:

- Create blind calibration
- Hidden agent answer
- User answer capture
- Comparison report
- Update proposal
- Version history

---

### 10.6 Self Model

Show:

- Core Self
- Language Models
- Role Models
- Relationship Models
- Scene Models
- Boundaries
- Current State
- Unknowns
- Evidence Links
- Confidence Scores

Support export:

- Markdown
- JSON
- Prompt
- Skill draft

MVP should only support Markdown and JSON.

---

### 10.7 Contexts

User manages:

- Languages
- Roles
- Relationships
- Scenes
- Combinations

Each Context includes:

- Name
- Type
- Description
- Default language
- Related relationships
- Related roles
- Usage boundaries
- Training status
- Sample count
- Last updated time

---

### 10.8 Tasks

User selects task:

- Reply to message
- Write copy
- Write video script
- Write course content
- Write email
- Simulate chat
- Rewrite in my style
- Swedish reply
- English work reply

---

### 10.9 Versions

Show:

- Self Model version history
- Reason for each update
- Affected scope
- New evidence
- User approval status
- Rollback option

---

## 11. Data Model

The following database tables are recommended. Use PostgreSQL + JSONB, or Supabase / Prisma.

---

### 11.1 users

```ts
type User = {
  id: string
  email: string
  name?: string
  created_at: string
  updated_at: string
}
```

---

### 11.2 projects

```ts
type Project = {
  id: string
  user_id: string
  name: string
  goal: string
  created_at: string
  updated_at: string
}
```

---

### 11.3 contexts

Context represents languages, roles, relationships, and scenarios.

```ts
type Context = {
  id: string
  project_id: string
  type: 'language' | 'role' | 'relationship' | 'scene'
  name: string
  description?: string
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}
```

Example:

```json
{
  "type": "language",
  "name": "Swedish",
  "metadata": {
    "current_level": "intermediate",
    "grammar_error_policy": "preserve_light_non_native_trace",
    "polish_levels": [0, 1, 2, 3, 4]
  }
}
```

---

### 11.4 context_combinations

Used to represent trainable combinations.

```ts
type ContextCombination = {
  id: string
  project_id: string
  name: string
  language_context_id?: string
  role_context_id?: string
  relationship_context_id?: string
  scene_context_id?: string
  description?: string
  status: 'new' | 'training' | 'trained' | 'needs_more_data'
  created_at: string
  updated_at: string
}
```

---

### 11.5 raw_materials

```ts
type RawMaterial = {
  id: string
  project_id: string
  source_type:
    | 'chat'
    | 'copywriting'
    | 'email'
    | 'social_post'
    | 'diary'
    | 'course_script'
    | 'product_text'
    | 'sales_reply'
    | 'chatgpt_conversation'
    | 'interview'
    | 'blind_calibration'
    | 'task_feedback'
    | 'other'
  content: string
  language?: string
  context_ids: string[]
  source_metadata: Record<string, any>
  created_at: string
  material_time?: string
}
```

---

### 11.6 evidence_items

Evidence supports model claims.

```ts
type EvidenceItem = {
  id: string
  project_id: string
  raw_material_id?: string
  claim: string
  evidence_text: string
  context_ids: string[]
  signal_type:
    | 'fact'
    | 'voice_pattern'
    | 'reaction_pattern'
    | 'decision_pattern'
    | 'relationship_pattern'
    | 'language_pattern'
    | 'boundary'
    | 'current_state'
  confidence: number
  stability: 'low' | 'medium' | 'high'
  first_seen: string
  last_seen: string
  created_at: string
}
```

---

### 11.7 self_models

```ts
type SelfModel = {
  id: string
  project_id: string
  version: string
  status: 'active' | 'archived'
  core_self: Record<string, any>
  language_models: Record<string, any>
  role_models: Record<string, any>
  relationship_models: Record<string, any>
  scene_models: Record<string, any>
  boundaries: Record<string, any>
  unknowns: Record<string, any>
  created_at: string
}
```

---

### 11.8 interviews

```ts
type Interview = {
  id: string
  project_id: string
  type:
    | 'daily'
    | 'information'
    | 'role'
    | 'language'
    | 'relationship'
    | 'stress'
    | 'conflict'
    | 'creative'
  interviewer_persona: string
  target_context_ids: string[]
  goal: string
  transcript: Array<{
    speaker: 'agent' | 'user'
    text: string
    timestamp: string
  }>
  extraction_report?: Record<string, any>
  created_at: string
}
```

---

### 11.9 blind_calibrations

```ts
type BlindCalibration = {
  id: string
  project_id: string
  context_combination_id?: string
  scenario: string
  incoming_message?: string
  hidden_agent_answer: string
  user_answer: string
  comparison_report?: Record<string, any>
  update_proposal?: Record<string, any>
  user_decision?: 'accepted' | 'partially_accepted' | 'rejected' | 'edited'
  created_at: string
}
```

---

### 11.10 model_updates

```ts
type ModelUpdate = {
  id: string
  project_id: string
  previous_model_id: string
  new_model_id?: string
  source_type: 'import' | 'interview' | 'blind_calibration' | 'task_feedback'
  source_id: string
  update_summary: string
  affected_paths: string[]
  confidence_delta?: number
  user_approved: boolean
  created_at: string
}
```

---

### 11.11 task_outputs

```ts
type TaskOutput = {
  id: string
  project_id: string
  task_type:
    | 'chat_reply'
    | 'copywriting'
    | 'video_script'
    | 'course'
    | 'email'
    | 'sales_reply'
    | 'rewrite'
    | 'decision_support'
  input: string
  context_ids: string[]
  output: string
  feedback?: {
    likeness_score?: number
    usefulness_score?: number
    comments?: string
    labels?: string[]
  }
  created_at: string
}
```

---

## 12. Self Model Structure

The Self Model should be stored as JSON and displayed as Markdown.

### 12.1 Self Model JSON Schema

```json
{
  "version": "0.1",
  "core_self": {
    "identity": [],
    "values": [],
    "long_term_preferences": [],
    "decision_patterns": [],
    "communication_boundaries": [],
    "stable_dislikes": []
  },
  "language_models": {
    "zh": {
      "voice_summary": "",
      "sentence_patterns": [],
      "tone_patterns": [],
      "common_words": [],
      "avoid": [],
      "confidence": 0.0
    },
    "en": {
      "voice_summary": "",
      "professional_style": "",
      "casual_style": "",
      "confidence": 0.0
    },
    "sv": {
      "voice_summary": "",
      "current_level": "",
      "common_mistakes": [],
      "improvement_trend": "",
      "polish_policy": {
        "friend_chat": 1,
        "formal_message": 3,
        "simulate_user": 1
      },
      "confidence": 0.0
    }
  },
  "role_models": {
    "boss": {
      "style_summary": "",
      "feedback_style": "",
      "conflict_style": "",
      "task_assignment_style": "",
      "boundaries": [],
      "evidence_ids": []
    },
    "mother": {
      "style_summary": "",
      "comfort_style": "",
      "worry_style": "",
      "discipline_style": "",
      "evidence_ids": []
    }
  },
  "relationship_models": {
    "close_friend": {
      "style_summary": "",
      "humor": "",
      "comfort_style": "",
      "reply_length": "",
      "emoji_policy": "",
      "sensitive_boundaries": [],
      "evidence_ids": []
    }
  },
  "scene_models": {
    "comforting": {
      "default_intent": "",
      "typical_structure": [],
      "avoid": []
    },
    "work_delay_feedback": {
      "default_intent": "",
      "typical_structure": [],
      "avoid": []
    }
  },
  "current_state": {
    "recent_changes": [],
    "temporary_mood_patterns": [],
    "language_progress": []
  },
  "unknowns": [],
  "boundaries": {
    "must_not_invent": [],
    "requires_user_confirmation": [],
    "sensitive_topics": []
  }
}
```

---

## 13. LLM / Agent Behavior Design

### 13.1 Import Analyzer

Input:

- raw_material
- source_type
- optional context

Output:

- material classification
- extracted evidence
- possible context tags
- voice signals
- model update proposal

Requirements:

- Do not treat AI-generated content as the user’s authentic style unless confirmed.
- Use different weights for public content and private chat.
- Reduce current-style weight for old materials.
- Increase weight for materials explicitly confirmed by the user.
- Preserve original evidence text.

---

### 13.2 Interview Planner

Input:

- current_self_model
- target_context
- unknowns
- previous_interviews

Output:

- interview goal
- interviewer persona
- 5-10 questions or simulated turns
- expected signals

Requirements:

- Do not ask vague life questions.
- Every interview must have a clear sampling goal.
- Questions should elicit user behavior, not just abstract self-description.
- Different interviewer identities and tones may be used.
- If the user corrects the agent, record that as a high-value signal.

---

### 13.3 Interview Extractor

Input:

- transcript
- interview goal
- target_context

Output:

- explicit information
- interaction behavior
- tone signals
- correction behavior
- role-specific patterns
- language-specific patterns
- update proposal

Key point:

Do not only extract what the user answered.  
Also extract how the user answered.

---

### 13.4 Blind Calibration Comparator

Input:

- scenario
- hidden_agent_answer
- user_answer
- context
- current_self_model

Output:

- difference report
- update proposal
- confidence impact
- affected model paths

Comparison dimensions:

1. Intent
2. Emotional tone
3. Relationship distance
4. Structure order
5. Language style
6. Action taken
7. Length
8. Politeness
9. Grammar / preserved mistakes
10. Scenario boundaries

---

### 13.5 Persona Router

Input:

- user task
- selected context
- detected context
- self_model

Output:

- selected language model
- selected role model
- selected relationship model
- selected scene model
- polish level
- boundary warnings

In the MVP, if the context is unclear, require manual user selection.  
Automatic detection can come later.

---

### 13.6 Output Generator

Input:

- task
- selected models
- raw prompt
- boundary rules

Output:

- draft answer

Requirements:

- The output should not be “the best AI answer.”
- It should be what the user would likely say in this context.
- If the user selects polished mode, moderate improvement is allowed.
- If the user selects simulate mode, preserve realistic habits and reasonable imperfections.
- If the output is Swedish, control grammar correction through polish level.
- Sensitive scenarios must ask the user to confirm or take over.

---

## 14. Prompt Templates

### 14.1 Blind Calibration Hidden Answer Prompt

```text
You are generating a hidden predicted reply for the user.

Goal:
Predict how the user would actually respond in this specific context.

Do not generate an ideal assistant answer.
Do not over-polish.
Use the selected Self Model only.
Respect language, role, relationship, scene, and current style settings.

Context:
{{context}}

Self Model:
{{self_model_subset}}

Incoming message or scenario:
{{scenario}}

Return only the predicted user reply.
```

---

### 14.2 Comparison Prompt

```text
Compare the hidden agent answer and the user's real answer.

Do not judge which answer is better.
Identify how the agent failed to predict the user.

Compare across:
- intent
- emotional tone
- relationship distance
- structure
- sentence length
- directness
- politeness
- action taken
- language quirks
- omissions
- boundaries

Scenario:
{{scenario}}

Hidden agent answer:
{{hidden_agent_answer}}

User real answer:
{{user_answer}}

Current Self Model:
{{self_model_subset}}

Return:
1. short summary
2. detailed differences
3. update proposal
4. affected model paths
5. confidence level
6. whether this is one-time, context-specific, or long-term
```

---

### 14.3 Interview Extraction Prompt

```text
Extract model-relevant information from this interview.

Do not only summarize what the user said.
Also analyze how the user said it.

Interview goal:
{{goal}}

Interviewer persona:
{{interviewer_persona}}

Target context:
{{target_context}}

Transcript:
{{transcript}}

Extract:
1. explicit facts
2. user preferences
3. tone patterns
4. reaction patterns
5. correction behavior
6. role-specific behavior
7. relationship-specific behavior
8. language-specific behavior
9. possible model updates
10. evidence quotes
11. confidence levels
```

---

## 15. Model Update Rules

### 15.1 Update Levels

Every update must be classified as one of:

1. Temporary State  
   Example: recently anxious, recently irritated, recently busy.

2. Context-Specific Pattern  
   Example: as a boss, the user is more direct when handling delays.

3. Language-Specific Pattern  
   Example: the user’s Swedish word order mistakes are decreasing.

4. Relationship-Specific Pattern  
   Example: with close friends, the user is shorter and more direct.

5. Core Self Update  
   Example: the user consistently dislikes marketing-style language.

Core Self Updates require multiple pieces of evidence.  
Do not update the core self from a single blind calibration.

---

### 15.2 Evidence Weighting

Suggested weights:

```text
User explicitly states something: high
User naturally demonstrates something in an interview: high
User’s real answer in blind calibration: high
Real task feedback: high
Private chat records: high
User-written copy: medium-high
ChatGPT conversations: medium-high for preferences and projects, not directly for tone
Public posts: medium
Resume / bio: medium for facts, not for tone
Other people describing the user: low
AI-written content not confirmed by the user: low
```

---

### 15.3 Time Decay

Older materials should have lower weight for current expression style.

But old materials can still be valid for long-term facts and life history.

Examples:

- Swedish grammar mistakes from 2024 should not strongly represent the user’s Swedish level in 2026.
- An important experience from 2023 can remain part of long-term memory.
- Expression from a difficult emotional period should not become a permanent personality rule.

---

## 16. Safety and Boundaries

### 16.1 Draft Mode First

The MVP only supports Draft Mode.

The system generates draft replies.  
The user decides whether to send them.

Do not build automatic proxy chatting in the MVP.

---

### 16.2 Do Not Build Live Proxy Mode in MVP

If Live Proxy Mode is built later, it must include:

- Explicit authorization
- Specific allowed contacts
- Takeover at any time
- Stop on sensitive topics
- Confirmation for important commitments
- Stop for money, legal, medical, or major relationship decisions
- Disclosure policy decided by product strategy, but the system must keep boundary warnings

---

### 16.3 Sensitive Topic Stop Rules

The system must ask the user to confirm or take over for:

- Breakups / divorce / serious relationship conflict
- Self-harm / harm to others
- Medical advice
- Legal commitments
- Financial commitments
- Large transactions
- Hiring / firing
- Sexual topics
- Violent threats
- Identity deception
- Long-term automatic impersonation

---

### 16.4 Privacy

The system must provide:

- Delete all data
- Delete a single material
- Export Self Model
- Export raw materials
- Disable a context
- Prevent a material type from being used for training
- Future option: local-first or encrypted storage

---

## 17. Technical Recommendations

### 17.1 Frontend

Recommended:

- Next.js
- React
- Tailwind CSS
- shadcn/ui
- Zustand or Redux Toolkit
- React Hook Form

---

### 17.2 Backend

Recommended:

- Next.js API Routes or separate Node.js / FastAPI backend
- PostgreSQL
- Prisma
- Optional pgvector for material retrieval
- Optional Redis for background jobs
- S3 / Supabase Storage for file storage

---

### 17.3 LLM

MVP can use:

- OpenAI Responses API or Chat Completions
- JSON schema structured output
- Embeddings for material retrieval
- Background jobs for long material analysis

All LLM outputs should store both raw response and parsed response for debugging.

---

### 17.4 Recommended Directory Structure

```text
/self-distiller
  /app
    /dashboard
    /import
    /interview
    /calibration
    /contexts
    /self-model
    /tasks
    /versions
  /components
  /lib
    /llm
    /prompts
    /model-updates
    /self-model
    /context-router
  /prisma
    schema.prisma
  /types
    self-model.ts
    context.ts
    calibration.ts
  /prompts
    import-analyzer.md
    interview-planner.md
    interview-extractor.md
    blind-hidden-answer.md
    blind-comparator.md
    output-generator.md
```

---

## 18. API Design Suggestions

### 18.1 Create Project

```http
POST /api/projects
```

Body:

```json
{
  "name": "My Self Model",
  "goal": "Make the agent reply to close friends like me"
}
```

---

### 18.2 Create Context

```http
POST /api/contexts
```

Body:

```json
{
  "project_id": "project_123",
  "type": "role",
  "name": "Boss",
  "description": "How I communicate when managing subordinates at work"
}
```

---

### 18.3 Import Material

```http
POST /api/materials
```

Body:

```json
{
  "project_id": "project_123",
  "source_type": "chat",
  "content": "...",
  "language": "zh",
  "context_ids": ["ctx_friend", "ctx_chinese"]
}
```

---

### 18.4 Analyze Material

```http
POST /api/materials/:id/analyze
```

Output:

```json
{
  "classification": {},
  "evidence_items": [],
  "update_proposal": {}
}
```

---

### 18.5 Start Interview

```http
POST /api/interviews
```

Body:

```json
{
  "project_id": "project_123",
  "type": "role",
  "interviewer_persona": "subordinate",
  "target_context_ids": ["ctx_boss"],
  "goal": "Collect how the user communicates as a boss when handling delays"
}
```

---

### 18.6 Extract Interview

```http
POST /api/interviews/:id/extract
```

---

### 18.7 Create Blind Calibration

```http
POST /api/calibrations
```

Body:

```json
{
  "project_id": "project_123",
  "context_combination_id": "combo_123",
  "scenario": "A friend says: I feel like a failure lately."
}
```

Process:

1. Server generates hidden_agent_answer.
2. Client does not show it.
3. Client asks user for user_answer.

---

### 18.8 Submit User Answer

```http
POST /api/calibrations/:id/user-answer
```

Body:

```json
{
  "user_answer": "Don’t say that so quickly. You may just be exhausted lately. What happened?"
}
```

Server returns comparison_report and update_proposal.

---

### 18.9 Approve Model Update

```http
POST /api/model-updates/:id/approve
```

---

### 18.10 Generate Task Output

```http
POST /api/tasks/generate
```

Body:

```json
{
  "project_id": "project_123",
  "task_type": "chat_reply",
  "input": "A friend says: I feel really frustrated lately.",
  "context_ids": ["ctx_zh", "ctx_close_friend", "ctx_comforting"],
  "mode": "draft"
}
```

---

## 19. Page-Level Requirements

### 19.1 Import Page

User actions:

1. Click Add Material.
2. Paste text or upload file.
3. Select material type.
4. Select language.
5. Select related context.
6. Click Analyze.
7. Review extraction results.
8. Decide whether to add the results to the model.

Acceptance criteria:

- User can upload or paste text.
- System saves raw material.
- System generates at least 3 evidence items.
- User can reject individual evidence items.
- Accepted evidence can enter Self Model update candidates.

---

### 19.2 Interview Studio Page

User actions:

1. Select interview goal.
2. Select interviewer persona.
3. Select language, role, relationship, scenario.
4. Start conversation.
5. End interview.
6. Generate extraction report.
7. Accept or reject model update.

Acceptance criteria:

- System generates interview questions based on the goal.
- System saves full transcript.
- System extracts explicit information and interaction behavior.
- System generates update proposal.
- After user confirmation, the system creates a new Self Model version.

---

### 19.3 Calibration Page

User actions:

1. Select context combination.
2. System generates scenario.
3. Agent hidden answer is generated in the background.
4. User enters real answer.
5. System shows comparison.
6. User accepts or edits update proposal.

Acceptance criteria:

- Agent reply is not visible before user submits their answer.
- After submission, user sees both agent answer and user answer.
- System generates difference report.
- System generates model update proposal.
- After confirmation, the model version updates.

---

### 19.4 Self Model Page

User can view:

- Current version
- Core information
- Language models
- Role models
- Relationship models
- Scene models
- Evidence links
- Confidence
- Unknowns
- Boundaries

Acceptance criteria:

- Each model claim can be traced to evidence.
- User can delete or disable a claim.
- User can export Markdown.
- User can roll back versions.

---

## 20. MVP Acceptance Metrics

### 20.1 Functional Metrics

At MVP completion, the product must support:

1. Create project.
2. Add Chinese language.
3. Add one relationship, such as close friend.
4. Add one scenario, such as comforting.
5. Import at least 10 text materials.
6. Generate Self Model v0.1.
7. Complete at least 1 interview.
8. Generate Interview Extraction Report.
9. Complete at least 5 blind calibrations.
10. Generate Self Model v0.2.
11. Use v0.2 to generate a chat reply draft.
12. Export Self Model Markdown.

---

### 20.2 Experience Metrics

After first-round training, the user should feel:

- The system does not sound like generic AI.
- The system recognizes their directness, length, tone, and relationship distance.
- The second-round output sounds more like them than the first-round output.
- The user understands why the model made certain judgments.
- The user can correct the model.
- The user can see the model evolving.

---

### 20.3 Quality Metrics

Use human scoring:

For each output, the user rates:

- Likeness Score: 1-5
- Usefulness Score: 1-5
- Safety / Boundary Score: 1-5

MVP success criteria:

- After 5 blind calibrations, the second-round Likeness Score improves by at least 1 point on average compared to the first round.
- At least 70% of outputs are rated “basically sounds like me” or better.
- All model claims are traceable to evidence.
- User can reject incorrect updates.

---

## 21. Future Versions

### 21.1 V1

- Support more file formats.
- Support ChatGPT export parsing.
- Support manual import of WhatsApp / Telegram / WeChat chat records.
- Support multiple language models.
- Support Swedish polish level control.
- Support more task types.
- Support embedding retrieval.
- Support fuller version comparison.

---

### 21.2 V2

- Browser extension.
- Gmail / Google Docs / Notion connectors.
- Multi-device support.
- Stronger Persona Router.
- Semi-automatic real message drafting.
- Relationship-specific models for multiple contacts.
- Export to ChatGPT Skill / Claude Project / Cursor Rule.
- Self Model API.

---

### 21.3 V3

- Live Proxy Mode with strict authorization and boundaries.
- Voice input.
- Voice style analysis, but not voice cloning as the first priority.
- Multimodal materials.
- Team version.
- Creator template marketplace.
- Self Model benchmark evaluation.

---

## 22. Development Priority

### Phase 1: Foundation

- Auth
- Project
- Contexts
- Raw Materials
- Self Model storage
- Basic LLM calls

---

### Phase 2: Import and Initial Distillation

- Import UI
- Material analyzer
- Evidence extraction
- Self Model v0.1 generation
- Markdown export

---

### Phase 3: Interview System

- Interview planner
- Interview chat UI
- Interview extractor
- Update proposal

---

### Phase 4: Blind Calibration

- Hidden answer generation
- User answer capture
- Comparator
- Update proposal
- Versioning

---

### Phase 5: Task Output

- Context selection
- Persona Router
- Output Generator
- Feedback capture

---

## 23. Notes for Coding Agent

1. Implement data structures and the core loop first. Do not start with complex UI.
2. Use structured JSON for all LLM outputs whenever possible.
3. All model updates must be proposals. Do not directly write into the long-term model by default.
4. Create a new version only after user confirmation.
5. Each Self Model version must be immutable.
6. Evidence must be traceable.
7. Raw material text must not be discarded.
8. Context must be composable. Do not hardcode “friend / work / Chinese.”
9. In blind calibration, hidden_agent_answer must not be shown before user submission.
10. MVP only supports Draft Mode, not automatic proxy chat.
11. All sensitive scenarios must go through boundary checks.
12. For Swedish or other non-native language expression, support polish levels. Do not always mimic mistakes, and do not automatically turn the user into a perfect native speaker.
13. Interviews must extract both content and interaction behavior.
14. Do not upgrade one answer into a core personality rule.
15. Support version rollback.

---

## 24. Minimum Development Loop

The first working version can implement this loop:

```text
1. User creates a project
2. User adds Context: Chinese + close friend + comforting scenario
3. User pastes 10 chat samples
4. System analyzes samples and generates Self Model v0.1
5. System starts a close-friend interview
6. User answers 5 simulated messages
7. System generates Interview Extraction Report
8. System creates 5 blind calibration scenarios
9. For each scenario, agent generates hidden answer first, then user answers
10. System compares and proposes updates
11. User accepts updates
12. System generates Self Model v0.2
13. User inputs a real friend message
14. System generates a reply draft using v0.2
15. User scores and gives feedback
16. System exports Self Model Markdown
```

If this loop works, the product direction is validated.

---

## 25. Final Product Definition

Self Distiller’s goal is not to make AI generally smarter.  
Its goal is to make AI express the user more accurately in the right language, role, relationship, and scenario.

It learns from the user through four inputs:

```text
Imported materials: learn from the past user
Role-based interviews: actively sample the missing user
Blind calibration: correct predictions with real user answers
Task feedback: evolve through real usage
```

The final Self Model should be:

- Multilingual
- Multi-role
- Multi-relationship
- Multi-scenario
- Evolving
- Traceable
- Reversible
- Exportable
- Callable by agents

It can be used to:

- Reply to close friends like the user
- Write copy like the user
- Create courses like the user
- Handle customers like the user
- Communicate at work like the user
- Preserve real expression differences across languages
- Capture how the user changes over time

The MVP success criterion is simple:

> The second-round agent reply should sound more like the user than the first-round reply, and the user should understand why it became more accurate.
