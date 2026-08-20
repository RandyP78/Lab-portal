// Readiness assessment definition — mirrored in netlify/functions/api.js (IDs must match)
export const CATEGORIES = [
  {
    id: "regulatory",
    name: "Regulatory (CLIA)",
    questions: [
      { id: "reg1", text: "Do you hold a current CLIA certificate appropriate for your test complexity?" },
      { id: "reg2", text: "Is your state laboratory license current and displayed?" },
      { id: "reg3", text: "Have you designated a qualified Laboratory Director of record?" },
      { id: "reg4", text: "Is your test menu documented with complexity classification for each assay?" },
      { id: "reg5", text: "Are proficiency testing enrollments active for all regulated analytes?" },
    ],
  },
  {
    id: "personnel",
    name: "Personnel & training",
    questions: [
      { id: "per1", text: "Do all testing personnel meet CLIA qualification requirements for their role?" },
      { id: "per2", text: "Are competency assessments completed and documented for each employee?" },
      { id: "per3", text: "Is initial and annual training documented for every test system?" },
      { id: "per4", text: "Are personnel files complete (licenses, diplomas, job descriptions)?" },
    ],
  },
  {
    id: "sops",
    name: "SOPs & documentation",
    questions: [
      { id: "sop1", text: "Do you have written SOPs for every test performed?" },
      { id: "sop2", text: "Are SOPs reviewed and signed by the Laboratory Director?" },
      { id: "sop3", text: "Is document control in place (versioning, review dates, archived copies)?" },
      { id: "sop4", text: "Are specimen collection, handling, and rejection criteria documented?" },
    ],
  },
  {
    id: "equipment",
    name: "Equipment & validation",
    questions: [
      { id: "eq1", text: "Is every instrument validated/verified before patient testing?" },
      { id: "eq2", text: "Are calibration and calibration verification records current?" },
      { id: "eq3", text: "Is preventive maintenance scheduled and documented for all equipment?" },
      { id: "eq4", text: "Are temperature-dependent storage units monitored and logged daily?" },
    ],
  },
  {
    id: "qc",
    name: "Quality control & testing",
    questions: [
      { id: "qc1", text: "Is QC run and documented at the required frequency for each test?" },
      { id: "qc2", text: "Are QC failures investigated with documented corrective action?" },
      { id: "qc3", text: "Do you have a written Individualized Quality Control Plan (IQCP) where applicable?" },
      { id: "qc4", text: "Are reference ranges and critical values established and verified?" },
    ],
  },
  {
    id: "safety",
    name: "Safety & compliance",
    questions: [
      { id: "saf1", text: "Is your OSHA bloodborne pathogen exposure control plan current?" },
      { id: "saf2", text: "Is a chemical hygiene plan in place with SDS access for all reagents?" },
      { id: "saf3", text: "Are biohazard waste disposal contracts and manifests maintained?" },
      { id: "saf4", text: "Are safety training and drills (fire, spill, exposure) documented annually?" },
    ],
  },
];

export const ANSWER_OPTIONS = [
  { value: 2, label: "Yes" },
  { value: 1, label: "Partial" },
  { value: 0, label: "No" },
];

export const DOCUMENT_CATEGORIES = [
  "CLIA / Licensure",
  "Personnel Records",
  "SOPs",
  "Equipment / Validation",
  "Quality Control",
  "Safety",
  "General",
];
