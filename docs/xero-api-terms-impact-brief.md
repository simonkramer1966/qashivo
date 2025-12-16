# Qashivo: Xero API Terms Impact Brief

**Date:** December 2025  
**Re:** Xero Developer Platform Terms Update (4 December 2025)

---

## Executive Summary

Xero's updated Developer Platform Terms (effective 4 December 2025) introduce a blanket prohibition on using API data to train AI/ML models or for predictive analytics. This fundamentally changes how Qashivo can position its "intelligent" features but **does not prevent the core credit control automation** that drives customer value.

---

## The Restriction (Verbatim)

> "You must not use API Data sourced from the Xero developer platform to train or fine tune any artificial intelligence models including machine learning tools, large language models or predictive analytics tools."

**Key terms defined:**
- **API Data** = Any information accessed, received, transmitted, or generated through the Xero developer platform
- **AI Models** = Machine learning tools, large language models, predictive analytics tools

---

## What This DOES Prohibit

| Prohibited Activity | Example in Qashivo Context |
|---------------------|---------------------------|
| Training ML models on payment data | Building a model that learns "Customer X typically pays 15 days late" from Xero invoices |
| Fine-tuning LLMs on debtor data | Using Xero invoice/contact data to fine-tune OpenAI for better collections responses |
| Predictive analytics from patterns | "AI predicts 73% chance of payment by Friday" based on historical Xero payment data |
| Building customer payment profiles | Scoring customers based on learned payment behavior from Xero data |
| Improving forecasts through learning | "Our forecast accuracy improves as we learn your customers' patterns" |

---

## What This DOES NOT Prohibit

| Permitted Activity | How Qashivo Can Use It |
|-------------------|------------------------|
| Real-time data display | Show current AR aging, overdue invoices, DSO metrics |
| Rule-based automation | "If invoice 30+ days overdue AND no recent contact → send reminder" |
| Scenario-based forecasting | "Best case: all invoices paid on time. Worst case: historical average delays applied" |
| AI for content generation (not trained on Xero data) | Using OpenAI to generate email copy based on prompts (not fine-tuned on their data) |
| Real-time AI classification | Charlie classifying call outcomes in real-time (not learning patterns) |
| User-defined rules and policies | Customer-configured escalation paths, chase schedules, priority rules |

---

## Impact on Current Qashivo Proposition

### BEFORE (What We Were Claiming)

1. "AI that learns your customers' payment patterns"
2. "Predictive cashflow intelligence"
3. "ML-powered payment probability scores"
4. "Forecasts that improve over time"
5. "AI learns from every interaction"

### AFTER (What We Can Claim)

1. "Automated credit control that follows your rules"
2. "Scenario-based cashflow forecasting"
3. "Rule-based prioritization and scoring"
4. "Consistent, policy-driven collections"
5. "AI-powered communication (real-time, not trained on your data)"

---

## Revised Value Proposition

### Core Message Shift

| Old Positioning | New Positioning |
|-----------------|-----------------|
| "AI that learns" | "Automation that executes" |
| "Predictive intelligence" | "Scenario planning" |
| "ML-powered" | "Rule-based" or "Policy-driven" |
| "Gets smarter over time" | "Consistent and reliable" |

### The Good News

**The core value proposition remains intact:**

1. **Qashivo still IS the credit controller** - It still executes collections autonomously
2. **AI voice/SMS/email still works** - Charlie uses real-time AI responses, not trained models
3. **Time savings remain massive** - 10 minutes supervision vs 2-3 hours execution
4. **90-day DSO guarantee still viable** - Rule-based automation can still improve collections

### What Actually Changes

| Feature | Old Approach | New Approach |
|---------|--------------|--------------|
| Payment forecasting | ML prediction from patterns | Scenario-based (best/base/worst case) with user-adjustable assumptions |
| Customer scoring | ML-trained payment probability | Rule-based scoring (aging, invoice size, sector, dispute history) |
| Chase prioritization | AI-learned priority | Policy-driven rules (amount, age, customer tier) |
| Intent detection | Fine-tuned on responses | Prompt-based OpenAI (general model, not trained on Xero data) |

---

## Engineering Implications

### Charlie (Voice AI)
- **Current state**: Uses prompt-based OpenAI for real-time responses → **COMPLIANT**
- **Risk area**: If storing call outcomes to train future responses on Xero context → **MUST REMOVE**
- **Action**: Audit for any training/fine-tuning components; keep as real-time prompt-based only

### Credit Scoring Service
- **Current state**: Needs review - if scoring based on learned payment patterns → **NON-COMPLIANT**
- **Action**: Convert to explicit rule-based scoring (e.g., "invoice >60 days = high risk, >30 days = medium")

### Cashflow Forecasting
- **Current state**: Any ML-based prediction → **NON-COMPLIANT**
- **Action**: Replace with scenario-based forecasting using explicit assumptions, not learned patterns

### Intent Analyst
- **Current state**: Uses OpenAI for classification → **LIKELY COMPLIANT** (if not fine-tuned)
- **Action**: Confirm using base OpenAI models only; no fine-tuning on Xero-sourced communications

---

## Marketing Copy Changes Required

### Pages to Update
1. **Home.tsx** - Remove "AI-powered forecasts," "predictive intelligence"
2. **Demo.tsx** - Update cashflow section, remove learning claims

### Messaging Framework

**Don't Say:**
- "learns payment patterns"
- "predicts with X% accuracy"
- "ML-powered scoring"
- "AI that gets smarter"
- "predictive analytics"

**Do Say:**
- "follows your collection policies"
- "scenario-based forecasting"
- "rule-based prioritization"
- "consistent automated execution"
- "real-time AI communication"

---

## Competitive Implications

This restriction applies to **all Xero-connected apps**, meaning competitors face the same limitations. Our advantage shifts to:

1. **Best-in-class automation execution** (not ML sophistication)
2. **Supervised autonomy model** (user control, AI execution)
3. **Real-time AI communication** (Charlie's voice/SMS quality)
4. **User-configurable policies** (flexibility without ML complexity)

---

## Summary: What Qashivo Becomes

**Before:** "An AI that learns your business and predicts payment behavior"

**After:** "Autonomous credit control software that executes your policies 24/7, with AI-powered communication and scenario-based forecasting"

The core promise—**"Qashivo IS the credit controller"**—remains valid. The shift is from "intelligent prediction" to "reliable execution."

---

## Compliance Timeline

- **Terms effective:** 4 December 2025
- **Grace period for existing developers:** Until 2 March 2026
- **Recommended action:** Update all marketing and engineering before end of December 2025
