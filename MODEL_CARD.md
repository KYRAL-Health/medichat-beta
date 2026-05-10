# Applied Model Card: Kyral MediChat AI Health Assistant

**Version:** Beta  
**Organization:** Kyral Health  
**Date:** 2025  
**Contact:** https://kyralhealth.com

---

## 1. Model Summary

| Field | Details |
|---|---|
| **Model Name** | Kyral MediChat |
| **Base Model** | Qwen3-Next-80B-Instruct (`unsloth/Qwen3-Next-80B-Instruct`) |
| **Fine-tuning Method** | QLoRA (Quantized Low-Rank Adaptation) via Unsloth |
| **Deployment** | Self-hosted on Microsoft Azure via vLLM |
| **Inference Hardware** | 2× NVIDIA H100 (192 GB VRAM total) |
| **Application URL** | https://medichat.kyralhealth.com |
| **License** | Apache 2.0 |
| **Model Type** | Generative Large Language Model (LLM) |
| **Task** | Medical question answering, symptom assessment, health information retrieval |

MediChat is an open-source, privacy-first AI health assistant that provides patients and physicians with general health information, symptom guidance, and care navigation support. It is powered by a QLoRA fine-tuned Qwen3-Next-80B model trained on de-identified clinical case summaries from PubMed Central, served via a self-hosted vLLM deployment on Azure.

---

## 2. Intended Use

### 2.1 Primary Use Cases

- **Symptom Assessment:** Patients describe symptoms and receive plain-language explanations of possible conditions, triage urgency, and suggested next steps.
- **Treatment Information:** General information on medications, procedures, and care options.
- **ICD-10 / Medical Code Lookup:** Support for medical coding, billing accuracy, and interoperability standards.
- **Cost and Coverage Guidance:** Information on how healthcare systems operate, patient rights, and potential costs.
- **Document Intelligence:** RAG-based analysis of uploaded PDF/text records (e.g., discharge summaries, lab results) to surface insights within the chat.
- **Daily Health Dashboard:** Automated synthesis of a patient's logged health data into a structured daily overview with insights, recommendations, and red flags.

### 2.2 Intended Users

| User Type | Portal | Intended Interaction |
|---|---|---|
| **Patients** | Patient Portal | Self-service symptom queries, document uploads, health history logging |
| **Physicians / Clinicians** | Physician Portal | Review patient-submitted data, manage invite links, view AI-generated summaries |

### 2.3 Out-of-Scope Uses

- **Emergency medical guidance:** MediChat is not designed for real-time emergency triage. Users in emergency situations are directed to seek urgent care.
- **Replacing clinical diagnosis or treatment decisions:** The system explicitly does not provide medical advice and is not a substitute for licensed clinical judgment.
- **Pediatric-specific care, mental health crisis counseling, or highly specialized clinical domains** are not the primary intended focus.
- **Use by unlicensed individuals as a definitive diagnostic tool.**

---

## 3. System Context and Clinical Workflow

MediChat is positioned as a **pre- and post-consultation aid**, not a replacement for clinical care. It operates within the following workflow:

```
Patient describes symptoms / uploads documents
           ↓
MediChat provides informational guidance
  - PubMed citations injected for medical queries
  - Patient context (vitals, labs, conditions) grounded in response
  - Structured daily dashboard generated from health data
           ↓
Patient / Physician reviews AI output
           ↓
Clinician makes final diagnosis and care decisions
```

The system includes explicit copy in the UI and system prompt reminding users that all AI outputs are informational and must be reviewed by a qualified healthcare professional.

---

## 4. Model Development

### 4.1 Base Model

| Parameter | Value |
|---|---|
| **Base Model** | Qwen3-Next-80B-Instruct (`unsloth/Qwen3-Next-80B-Instruct`) |
| **Architecture** | Mixture-of-Experts (MoE) Transformer |
| **Total Parameters** | 80B |
| **Context Window (training)** | 2,048 tokens |
| **Framework** | Unsloth + Hugging Face Transformers + TRL |

### 4.2 Fine-tuning Methodology

Fine-tuning was performed using **QLoRA (Quantized Low-Rank Adaptation)** via the [Unsloth](https://github.com/unslothai/unsloth) library for memory-efficient training on large-scale hardware.

| Hyperparameter | Value |
|---|---|
| **LoRA Rank (r)** | 32 |
| **LoRA Alpha** | 32 |
| **LoRA Dropout** | 0 (optimized) |
| **Target Modules** | `q_proj`, `k_proj`, `v_proj`, `o_proj`, `gate_proj`, `up_proj`, `down_proj` |
| **Gradient Checkpointing** | Unsloth optimized |
| **Batch Size (per device)** | 2 |
| **Gradient Accumulation Steps** | 4 (effective batch size = 8) |
| **Learning Rate** | 2e-5 |
| **LR Scheduler** | Linear |
| **Warmup Steps** | 5 |
| **Training Epochs** | 1 |
| **Weight Decay** | 0.01 |
| **Precision** | bfloat16 |
| **Seed** | 3407 |
| **Training Hardware** | 2x H100 GPUs |
| **Export Format** | bf16 |

### 4.3 Chat Template

The Qwen-3 chat template was used with the following role mapping during fine-tuning: `user → human`, `assistant → gpt`. Instruction-following format with system, human, and assistant turns.

### 4.4 System Prompt (Production)

```
You are MediChat, a medical AI assistant speaking directly to the patient.
Be empathetic, clear, and structured.
If symptoms suggest an emergency, advise seeking urgent care.
Ground your response in PatientContext when available.
Ask clarifying questions when appropriate.
Do not provide medical advice; provide informational guidance and encourage clinician review where appropriate.
```

---

## 5. Training Data

### 5.1 Source Dataset

| Field | Details |
|---|---|
| **Dataset Name** | PMC-Patients |
| **Source** | PubMed Central (PMC) — peer-reviewed clinical case reports |
| **Nature** | De-identified patient case summaries extracted from biomedical literature |
| **Input File** | `PMC-Patients.csv` |

The PMC-Patients dataset is a publicly available, de-identified collection of real clinical case study summaries from peer-reviewed PubMed Central publications. It covers a broad range of medical conditions, demographics, and clinical presentations.

### 5.2 Dataset Generation Pipeline

Raw clinical case notes from PMC-Patients were converted into **conversational instruction-following format** using **Claude 3.5 Sonnet** (via AWS Bedrock) as a data synthesis model. The generation prompt instructed Claude to simulate natural patient-assistant dialogues from each clinical case, preserving clinical accuracy while using conversational language.

| Generation Parameter | Value |
|---|---|
| **Synthesis Model** | `anthropic.claude-3-5-sonnet` via AWS Bedrock |
| **Batch Size (generation)** | 5 cases per API call |
| **Output Format** | JSONL (`bedrock-conversation-2024` schema) |

### 5.3 Dataset Statistics

| Split | Samples |
|---|---|
| **Training** | 1,000 |
| **Test / Evaluation** | 100 |

Each sample follows this structure:
```json
{
  "system": "You are a digital assistant with friendly personality and medical knowledge...",
  "input": "Patient's natural-language symptom description",
  "output": "Assistant's medically-informed response with diagnosis, treatment, and recommendations"
}
```

### 5.4 Data Considerations

- All training data is derived from **de-identified, publicly available** clinical literature.
- No private patient health information (PHI) or user-generated content from the MediChat application was used in training.
- The dataset is synthetically reformatted from peer-reviewed case reports — inheriting any biases present in published biomedical literature (e.g., underrepresentation of certain demographics or rare conditions).

---

## 6. Retrieval-Augmented Generation (RAG)

MediChat augments model outputs with real-time retrieval from two sources:

### 6.1 PubMed Evidence Injection

For medical queries, a lightweight classifier step (using the `extract` model) determines whether PubMed search is warranted. If so, up to 5 relevant peer-reviewed articles are retrieved and injected verbatim into the system prompt. The model is instructed to include a `References` section with exact citations.

### 6.2 Document RAG

Users may upload PDF or text documents. Parsed document insights are retrieved via a `getDocumentInsights` tool call and included as context in the chat response.

---

## 7. Performance Assessment

### 7.1 Evaluation Approach

Evaluation was conducted on a held-out test set of 100 conversational examples derived from the PMC-Patients dataset using the same generation pipeline as the training data.

> **Note:** Formal clinical validation studies (e.g., prospective trials, comparison to clinician judgment) have not been conducted at this time. This is a **beta** product.

### 7.2 Known Performance Characteristics

| Characteristic | Notes |
|---|---|
| **Medical accuracy** | Trained on peer-reviewed clinical case summaries; performance is strongest on common conditions well-represented in PMC literature |
| **Conversational quality** | Fine-tuning emphasized natural, empathetic dialogue with structured clinical reasoning |
| **Citation grounding** | PubMed RAG provides contemporaneous evidence grounding for medical queries |
| **Context utilization** | Up to 30 recent messages and full patient profile context (vitals, labs, medications, conditions) are injected per turn |

### 7.3 Limitations and Failure Modes

| Risk | Description |
|---|---|
| **Hallucination** | As a generative LLM, MediChat can produce confident-sounding but incorrect medical information. RAG citations reduce but do not eliminate this risk. |
| **Training distribution bias** | PMC-Patients reflects published case literature, which may underrepresent certain populations (e.g., pediatric, geriatric, low-income, non-Western demographics). |
| **Context window limits** | The model was fine-tuned with a 2,048-token context window. Very long medical histories or documents may be truncated. |
| **Emergencies** | The system is not designed for real-time emergency response. Automated red-flag detection exists but must not be relied upon as the sole safety net. |
| **Rare conditions** | Performance on rare diagnoses or highly specialized clinical domains (e.g., uncommon genetic disorders) may be substantially lower. |
| **Medication interactions** | While the model has general pharmaceutical knowledge, it should not be relied upon for precise drug-drug interaction checking. |
| **Outdated information** | Model knowledge is bounded by the Qwen3 training cutoff; rapidly evolving clinical guidelines may not be reflected. |

---

## 8. Privacy and Data Governance

### 8.1 User Data Policy

| Policy | Detail |
|---|---|
| **Data retention** | No chat content or health data is retained after session for the purpose of training or analytics |
| **Training use** | No user-generated data from MediChat is used for model training or fine-tuning |
| **Data sales** | No user data is sold or shared with third parties |
| **PHI handling** | Users are advised not to input identifying information; the system does not require PHI for operation |

### 8.2 Authentication and Access Control

- **Authentication:** Clerk-based secure login with session management.
- **Patient isolation:** Each patient's data is scoped by user ID. Physicians can only access patient data via explicit invite acceptance.
- **Physician access:** Invite-based access with revocation capability.
- **Role-based context:** Patient portal and Physician portal operate with distinct system prompts and data access permissions.

### 8.3 Infrastructure

- **Hosting:** Microsoft Azure (self-hosted)
- **Inference:** vLLM serving stack
- **Monitoring:** Sentry for error monitoring and performance tracking
- **Transport:** HTTPS enforced

---

## 9. Ethical Considerations

### 9.1 Autonomy and Informed Consent

Users are presented with a disclaimer at onboarding and throughout the application that MediChat is **informational only** and not a substitute for professional medical advice. Users must explicitly accept this disclaimer before accessing the assistant.

### 9.2 Equity and Bias

The PMC-Patients dataset is derived from published biomedical literature, which historically overrepresents certain demographics. Kyral Health acknowledges the following:

- Conditions or presentations common in underrepresented populations may receive lower-quality responses.
- Synthetic data generation via Claude 3.5 Sonnet may propagate biases present in the foundation model or source literature.
- Ongoing monitoring for demographic equity in model outputs is recommended.

### 9.3 Transparency

- Model architecture, fine-tuning methodology, and training data sources are disclosed in this card.
- The application is open-source (Apache 2.0), enabling external audit.
- Citations from peer-reviewed literature are surfaced to users, enabling verification of claims.

### 9.4 Human Oversight

- The system is designed to **augment, not replace**, clinical judgment. All AI suggestions for record updates (vitals, conditions, medications) are surfaced as "proposed" items requiring explicit user acceptance.
- Memory proposals similarly require user confirmation before being stored.
- Physicians retain full control over patient record management.

---

## 10. Regulatory and Compliance Considerations

> **Important:** MediChat is currently positioned as a **consumer health information tool**, not a regulated medical device. It is not cleared or approved by the FDA or any equivalent regulatory body as a diagnostic or clinical decision support tool.

- Users should refer to Kyral Health's [Disclaimer, Privacy Policy and Terms and Conditions](https://kyralhealth.com) for full legal scope.
- Organizations deploying MediChat in clinical contexts should conduct their own regulatory risk assessment under applicable frameworks (e.g., FDA SaMD guidance, EU AI Act, HIPAA).

---

## 11. Maintenance and Monitoring

| Activity | Approach |
|---|---|
| **Error monitoring** | Sentry integration for runtime error tracking |
| **Model versioning** | Fine-tuned weights are versioned via training output directories; GGUF exports are tracked |
| **Retraining triggers** | Significant changes to clinical guidelines, new evidence on model failure modes, or demographic equity concerns |
| **Feedback loop** | User-driven memory and record suggestion acceptance/rejection provides implicit feedback signals |

---

## 12. References and Acknowledgments

- **PMC-Patients Dataset:** Zhao, R., et al. "PMC-Patients: A Large-scale Dataset of Patient Summaries and Relations for Benchmarking Retrieval-based Clinical Decision Support Systems." *arXiv* (2022).
- **Qwen3 Model Family:** Qwen Team, Alibaba Cloud. https://huggingface.co/Qwen
- **Unsloth Fine-tuning Framework:** https://github.com/unslothai/unsloth
- **vLLM Inference Engine:** https://docs.vllm.ai
- **CHAI Applied Model Card Framework:** Coalition for Health AI (CHAI). https://www.coalitionforhealthai.org

---

*This model card follows the CHAI Applied Model Card framework. For questions or concerns, contact Kyral Health at https://kyralhealth.com.*
