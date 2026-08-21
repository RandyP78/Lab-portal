// General licensing questionnaire — one intake feeds every state form.
// Field keys mirror the canonical model used by netlify/functions/lib/fillForms.js.

export const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
];

export const STATE_NAMES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
  CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho',
  IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina',
  ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas',
  UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia',
  WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia',
};

// States that have their own additional forms in the system (beyond the federal CLIA forms)
export const STATES_WITH_SPECIFIC_FORMS = ['CA', 'TX'];

// New York is not offered — it runs its own permit program handled outside this portal
export const SELECTABLE_STATES = US_STATES.filter((s) => s !== 'NY');
export const NY_DISCLAIMER =
  'Note: New York is not available here. NY operates its own clinical laboratory permit program ' +
  '(NYSDOH CLEP) with separate applications and standards — contact us directly if you need New York licensing.';

export const OWNERSHIP_TYPES = [
  { value: 'sole_proprietorship', label: 'Sole Proprietorship' },
  { value: 'general_partnership', label: 'General Partnership' },
  { value: 'limited_partnership', label: 'Limited Partnership' },
  { value: 'llp', label: 'Limited Liability Partnership (LLP)' },
  { value: 'llc', label: 'Limited Liability Company (LLC)' },
  { value: 'corporation', label: 'Corporation' },
  { value: 'unincorporated_association', label: 'Unincorporated Association' },
  { value: 'nonprofit', label: 'Nonprofit' },
  { value: 'religious', label: 'Religious Affiliation' },
  { value: 'city', label: 'City Government' },
  { value: 'county', label: 'County Government' },
  { value: 'state', label: 'State Government' },
  { value: 'federal', label: 'Federal Government' },
  { value: 'other_gov', label: 'Other Government' },
  { value: 'other', label: 'Other' },
];

export const CERTIFICATE_TYPES = [
  { value: 'compliance', label: 'Certificate of Compliance (state oversight)' },
  { value: 'accreditation', label: 'Certificate of Accreditation (deemed status)' },
  { value: 'waiver', label: 'Certificate of Waiver' },
  { value: 'ppm', label: 'Provider-Performed Microscopy (PPM)' },
];

export const ACCREDITING_ORGS = ['COLA', 'CAP', 'TJC', 'AABB', 'A2LA', 'ACHC', 'ASHI', 'AAHHS'];

export const PERSONNEL_ROLES = [
  { value: 'GS', label: 'General Supervisor (GS)' },
  { value: 'TS', label: 'Technical Supervisor / Consultant (TS)' },
  { value: 'TC', label: 'Technical Consultant (TC)' },
  { value: 'TP', label: 'Testing Personnel (TP)' },
];

export const DAYS = [
  { key: 'mon', label: 'Mon' }, { key: 'tue', label: 'Tue' }, { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' }, { key: 'fri', label: 'Fri' }, { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
];

export const DIRECTOR_LICENSE_TYPES = [
  'MD', 'DO', 'PhD (Bioanalyst)', 'Clinical Laboratory Bioanalyst', 'DPM', 'Other',
];

export const EMPTY_QUESTIONNAIRE = {
  targetStates: [],
  lab: {
    name: '', dba: '', address: '', suite: '', city: '', state: '', zip: '', county: '',
    phone: '', fax: '', email: '', effectiveDate: '', ein: '', testVolume: '',
    hours: {},
  },
  mailing: { sameAsPhysical: true, address: '', suite: '', city: '', state: '', zip: '' },
  ownership: { type: '', otherText: '' },
  license: {
    cliaNumber: '', cliaExpiration: '', certificateType: '', accreditingOrg: '',
    colaNumber: '', caStateId: '', caExpiration: '',
  },
  owners: [{ name: '', taxId: '', percent: '', address: '', city: '', state: '', zip: '', phone: '', title: '' }],
  director: {
    firstName: '', middleInitial: '', lastName: '', titles: '', licenseType: '', licenseNumber: '',
    licenseExpiration: '', licenseIssuer: '', phone: '', email: '', address: '', city: '', state: '', zip: '',
    associationDate: '', hoursPerWeek: '',
  },
  contact: { name: '', phone: '', email: '' },
  personnel: [{ firstName: '', middleInitial: '', lastName: '', roles: ['TP'], licenseType: '', licenseNumber: '' }],
  assistants: [],
  associatedLabs: [],
  preparedBy: { name: '', title: '' },
};
