// Licensing questionnaire → state form auto-fill engine.
// One canonical questionnaire feeds every form; each form's map bridges its own
// wording ("laboratory" vs "facility", "EIN" vs "Federal Tax ID", etc.).
import { PDFDocument, PDFName } from "pdf-lib";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// The bundler relocates this module at deploy time, so the blank-form folder
// can't be found with one fixed relative path — probe the likely locations once.
let BLANK_DIR = null;
function resolveBlankDir() {
  if (BLANK_DIR) return BLANK_DIR;
  const candidates = [];
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    candidates.push(
      path.join(here, "..", "forms-blank"),
      path.join(here, "forms-blank"),
      path.join(here, "netlify", "functions", "forms-blank"),
      path.join(here, "..", "netlify", "functions", "forms-blank"),
      path.join(here, "..", "..", "netlify", "functions", "forms-blank"),
    );
  } catch { /* import.meta unavailable */ }
  candidates.push(
    path.join(process.cwd(), "netlify", "functions", "forms-blank"),
    "/var/task/netlify/functions/forms-blank",
    path.join(process.cwd(), "forms-blank"),
  );
  for (const c of candidates) {
    try {
      if (existsSync(path.join(c, "CMS116.pdf"))) { BLANK_DIR = c; return c; }
    } catch { /* keep probing */ }
  }
  throw new Error("forms-blank directory not found. Tried: " + candidates.join(" | "));
}

// ---------- form catalog + packet logic ----------
export const FORM_CATALOG = [
  // Federal — every state
  { id: "CMS116", file: "CMS116.pdf", title: "CMS-116 · CLIA Application for Certification", group: "federal", stage: "initial" },
  { id: "CMS209", file: "CMS209.pdf", title: "CMS-209 · Laboratory Personnel Report (CLIA)", group: "federal", stage: "initial" },
  // California lab located in California
  { id: "LAB144", file: "LAB144.pdf", title: "LAB 144 · CA Clinical Laboratory License Application", group: "ca_in_state", stage: "initial" },
  { id: "LAB116", file: "LAB116.pdf", title: "LAB 116 · CA Clinical Laboratory Personnel Report", group: "ca_in_state", stage: "initial" },
  { id: "LAB144A", file: "LAB144A.pdf", title: "LAB 144A · CA Test Menu", group: "ca_in_state", stage: "initial" },
  { id: "LAB167", file: "LAB167.pdf", title: "LAB 167 · CA Annual Test Volume", group: "ca_in_state", stage: "initial" },
  { id: "LAB1513", file: "LAB1513.pdf", title: "LAB 1513 · CA Disclosure of Ownership & Control", group: "ca_in_state", stage: "initial" },
  { id: "LAB182", file: "LAB182.pdf", title: "LAB 182 · CA Statement by Laboratory Owner", group: "ca_in_state", stage: "initial" },
  { id: "LAB183", file: "LAB183.pdf", title: "LAB 183 · CA Statement by Laboratory Director", group: "ca_in_state", stage: "initial" },
  { id: "LAB144R", file: "LAB144R.pdf", title: "LAB 144R · CA License Renewal Application", group: "ca_in_state", stage: "renewal" },
  { id: "LAB193", file: "LAB193.pdf", title: "LAB 193 · CA Notification of Changes", group: "ca_in_state", stage: "changes" },
  // Out-of-state lab applying for a California license
  { id: "LAB144-OS", file: "LAB144-OS.pdf", title: "LAB 144-OS · CA License Application (Out-of-State Lab)", group: "ca_out_of_state", stage: "initial" },
  { id: "LAB116-OS", file: "LAB116-OS.pdf", title: "LAB 116-OS · CA Personnel Report (Out-of-State Lab)", group: "ca_out_of_state", stage: "initial" },
  { id: "LAB167-OS", file: "LAB167-OS.pdf", title: "LAB 167-OS · CA Annual Test Volume (Out-of-State Lab)", group: "ca_out_of_state", stage: "initial" },
  { id: "LAB168-OS", file: "LAB168-OS.pdf", title: "LAB 168-OS · CA Laboratory Director Qualifications", group: "ca_out_of_state", stage: "initial" },
  // Texas
  { id: "TX3225", file: "TX3225.pdf", title: "CMS-116 Supplement 3225 · Texas Disclosure of Ownership", group: "texas", stage: "initial", adobeOnly: true },
];

const GROUP_NAMES = {
  federal: "Federal CLIA forms (all states)",
  ca_in_state: "California license — lab located in CA",
  ca_out_of_state: "California license — lab located outside CA",
  texas: "Texas",
};

export function buildPacket(q) {
  const labState = String(q?.lab?.state || "").trim().toUpperCase();
  const targets = Array.isArray(q?.targetStates)
    ? q.targetStates.map((s) => String(s).trim().toUpperCase()).filter(Boolean)
    : [];
  const groups = ["federal"];
  if (targets.includes("CA")) groups.push(labState === "CA" ? "ca_in_state" : "ca_out_of_state");
  if (targets.includes("TX")) groups.push("texas");

  const packet = groups.map((g) => ({
    group: g,
    name: g === "federal" && targets.length
      ? `Federal CLIA forms — required for every state (${targets.join(", ")})`
      : GROUP_NAMES[g],
    forms: FORM_CATALOG.filter((f) => f.group === g).map(({ file, ...rest }) => rest),
  }));

  // States with no state-specific forms in the system yet — federal packet covers the filing
  const others = targets.filter((s) => s !== "CA" && s !== "TX");
  if (others.length) {
    packet.push({
      group: "federal_only",
      name: `Other states: ${others.join(", ")}`,
      forms: [],
      note: "These states are covered by the federal CMS forms above — no additional state-specific application forms are loaded in the system for them. If a state sends its own supplemental form, upload it in Documents and we can add it to the packet.",
    });
  }
  return packet;
}

// ---------- canonical helpers ----------
const S = (v) => (v == null ? "" : String(v).trim());
const join = (parts, sep = " ") => parts.map(S).filter(Boolean).join(sep);

function helpers(q) {
  const lab = q.lab || {};
  const mail = q.mailing?.sameAsPhysical === false ? q.mailing || {} : lab;
  const lic = q.license || {};
  const dir = q.director || {};
  const contact = q.contact || {};
  const owners = (q.owners || []).filter((o) => S(o.name));
  const personnel = (q.personnel || []).filter((p) => S(p.lastName) || S(p.firstName) || S(p.name));
  const assistants = (q.assistants || []).filter((a) => S(a.name));
  const assocLabs = (q.associatedLabs || []).filter((l) => S(l.name) || S(l.cliaNumber));
  const prep = q.preparedBy || {};
  const hours = lab.hours || {};

  const street = join([lab.address, lab.suite], ", ");
  const mailStreet = join([mail.address, mail.suite], ", ");
  const personName = (p) =>
    S(p.name) || join([p.firstName, p.middleInitial, p.lastName]);
  const dirFirstLast = join([dir.firstName, dir.middleInitial, dir.lastName]);
  const dirLastFirst = join([dir.lastName, join([dir.firstName, dir.middleInitial])], ", ");

  return {
    lab, mail, lic, dir, contact, owners, personnel, assistants, assocLabs, prep, hours,
    street, mailStreet,
    cityStZip: join([lab.city, lab.state, lab.zip], " "),
    mailCityStZip: join([mail.city, mail.state, mail.zip], " "),
    personName, dirFirstLast, dirLastFirst,
    dirNameTitle: join([dirFirstLast, dir.titles], ", "),
    dirCredentials: join([dir.licenseType, dir.licenseNumber], " #"),
    owner: owners[0] || {},
    today: new Date().toISOString().slice(0, 10),
  };
}

// Ownership vocabulary bridging (each agency words these differently)
const FOR_PROFIT = ["sole_proprietorship", "general_partnership", "limited_partnership", "llp", "llc", "corporation"];
const OWNERSHIP_LABELS = {
  sole_proprietorship: "Sole Proprietorship", general_partnership: "General Partnership",
  limited_partnership: "Limited Partnership", llp: "Limited Liability Partnership",
  llc: "Limited Liability Company", corporation: "Corporation",
  unincorporated_association: "Unincorporated Association", nonprofit: "Nonprofit",
  religious: "Religious Affiliation", city: "City", county: "County", state: "State",
  federal: "Federal", other_gov: "Other Government", other: "Other",
};

const DAY_FIELDS = [
  ["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"], ["thu", "Thursday"],
  ["fri", "Friday"], ["sat", "Saturday"], ["sun", "Sunday"],
];

// ---------- per-form field maps ----------
// Each map returns { text: {fieldName: value}, check: [fieldName...], radio: {group: option} }
const MAPS = {
  CMS116(q) {
    const h = helpers(q);
    const text = {
      "FACILITY NAME": join([h.lab.name, h.lab.dba && `DBA ${h.lab.dba}`], " — "),
      "FEDERAL TAX IDENTIFICATION NUMBER": h.lab.ein,
      "TELEPHONE NO Include area code": h.lab.phone,
      "FAX NO Include area code": h.lab.fax,
      "EMAIL ADDRESS": h.lab.email,
      "Facility Address - Number, Street (No P. Boxes)": h.street,
      "CITY": h.lab.city,
      "STATE (2 letter abbreviation)": h.lab.state,
      "ZIP CODE": h.lab.zip,
      "NUMBER STREET": h.mailStreet,
      "CITY_2": h.mail.city, "STATE_2": h.mail.state, "ZIP CODE_2": h.mail.zip,
      "NAME OF DIRECTOR Last First Middle Initial": h.dirLastFirst,
      "Laboratory Directors Phone Number": h.dir.phone,
      "CREDENTIALS": h.dirCredentials,
      "CLIA Identification Number": h.lic.cliaNumber,
      "Effective Date": h.lab.effectiveDate,
      "Anticipated Start Date": h.lab.effectiveDate,
      "TOTAL ESTIMATED ANNUAL TEST VOLUME": h.lab.testVolume,
    };
    for (const [key, day] of DAY_FIELDS) {
      const d = h.hours[key] || {};
      text[`${day} - From`] = d.from;
      text[`${day} - To`] = d.to;
    }
    h.assocLabs.slice(0, 6).forEach((l, i) => {
      text[`CLIA NUMBERRow${i + 1}`] = l.cliaNumber;
      text[i === 0 ? "NAME OF LABORATORY Row1" : `NAME OF LABORATORYRow${i + 1}`] = l.name;
    });
    const check = ["Initial Application", "Physical", "Physical_2"];
    const type = h.lic.certificateType;
    if (type === "waiver") check.push("Certificate of Waiver Complete Sections I  VI and IX  X");
    if (type === "ppm") check.push("Certificate for Provider Performed Microscopy Procedures PPM Complete Sections IVII and IXX");
    if (type === "compliance") check.push("Certificate of Compliance Complete Sections I  X");
    if (type === "accreditation") {
      check.push("Certificate of Accreditation Complete Sections I  X and indicate which of the following organizations your");
      const orgMap = { TJC: "The Joint Commission", ACHC: "ACHC", AABB: "AABB", A2LA: "A2LA", CAP: "CAP", COLA: "COLA", ASHI: "ASHI" };
      if (orgMap[h.lic.accreditingOrg]) check.push(orgMap[h.lic.accreditingOrg]);
    }
    const ot = q.ownership?.type;
    if (FOR_PROFIT.includes(ot)) {
      check.push("04 Proprietary");
      text["Specify"] = OWNERSHIP_LABELS[ot];
    } else if (ot === "religious") check.push("01 Religious Affiliation");
    else if (ot === "nonprofit") check.push("02 Private Nonprofit");
    else if (ot === "city") check.push("05 City");
    else if (ot === "county") check.push("06 County");
    else if (ot === "state") check.push("07 State");
    else if (ot === "federal") check.push("08 Federal");
    else if (ot === "other_gov") check.push("09 Other Government");
    return { text, check };
  },

  CMS209(q) {
    const h = helpers(q);
    const text = {
      "1 LABORATORY NAME": h.lab.name,
      "2 CLIA IDENTIFICATION NUMBER": h.lic.cliaNumber,
      "3 LABORATORY ADDRESS NUMBER AND STREET": h.street,
      "CITY": h.lab.city, "STATE": h.lab.state, "ZIP CODE": h.lab.zip,
      "5 TELEPHONE INCLUDE AREA CODE": h.lab.phone,
      "Printed name of lab director": h.dirFirstLast,
    };
    const check = [];
    // Row 1 = director, then testing personnel (a person can hold several roles)
    const rows = [{ name: h.dirLastFirst, roles: ["D"] }].concat(
      h.personnel.map((p) => ({
        name: h.personName(p),
        roles: Array.isArray(p.roles) && p.roles.length ? p.roles : (p.role ? [p.role] : ["TP"]),
      }))
    );
    rows.slice(0, 15).forEach((r, i) => {
      const n = i + 1;
      text[`EMPLOYEE NAMES ${n}`] = r.name;
      for (const role of r.roles) {
        if (role === "D") check.push(`D1 row${n}`);
        else if (role === "GS") check.push(`CT/GS1  row${n}`);
        else if (role === "TS") text[`TS1  row${n}`] = "X";
        else if (role === "TC") text[`TC1  row${n}`] = "X";
      }
    });
    return { text, check };
  },

  LAB144(q) { return lab144Map(q, false); },
  "LAB144R"(q) { return lab144Map(q, true); },

  LAB144A(q) {
    const h = helpers(q);
    return { text: {
      "Laboratory Name": h.lab.name,
      "Laboratory Location": join([h.lab.city, h.lab.state], ", "),
      "CLIA Number": h.lic.cliaNumber,
    } };
  },

  LAB116(q) {
    const h = helpers(q);
    const text = {
      "Laboratory Name": h.lab.name,
      "CLIA ID": h.lic.cliaNumber,
      "STATE ID": h.lic.caStateId,
      "Laboratory Address": join([h.street, h.cityStZip], ", "),
      "Contact Person": h.contact.name,
      "Email": h.contact.email || h.lab.email,
      "Print name": h.prep.name || h.contact.name,
      "Date Signed_af_date": h.today,
    };
    h.personnel.slice(0, 20).forEach((p, i) => {
      text[`Employee Name.${i}`] = h.personName(p);
      text[`License or Certificate Number.${i}`] = join([p.licenseType, p.licenseNumber], " ");
    });
    h.assistants.slice(0, 30).forEach((a, i) => {
      text[`Non-testing Employee Name.${i}`] = a.name;
      text[`Hours From.${i}`] = a.schedule;
      text[`Function.${i}`] = a.function || "Lab Assistant";
    });
    return { text };
  },

  LAB167(q) { return lab167Map(q); },
  "LAB167-OS"(q) { return lab167Map(q); },

  LAB1513(q) {
    const h = helpers(q);
    const text = {
      "entity": h.lab.name, "dba": h.lab.dba,
      "address": h.street, "city": h.lab.city, "state": h.lab.state, "zip": h.lab.zip,
      "clia": h.lic.cliaNumber, "taxid": h.lab.ein, "telephone": h.lab.phone,
      "authorizedrep": h.prep.name || h.owner.name, "title": h.prep.title,
      "datebottom": h.today,
    };
    h.owners.slice(0, 3).forEach((o, i) => {
      text[`name${i + 1}`] = o.name;
      text[`address${i + 1}`] = join([o.address, o.city, o.state, o.zip], ", ");
      text[`ein${i + 1}`] = o.taxId;
    });
    const check = [];
    const ot = q.ownership?.type;
    if (ot === "sole_proprietorship") check.push("sole");
    else if (["general_partnership", "limited_partnership", "llp"].includes(ot)) check.push("partnership");
    else if (["corporation", "llc"].includes(ot)) check.push("corporation");
    else if (ot === "unincorporated_association") check.push("associations");
    else if (ot) { check.push("other"); text["specify"] = OWNERSHIP_LABELS[ot] || q.ownership?.otherText; }
    return { text, check };
  },

  LAB182(q) {
    const h = helpers(q);
    return { text: {
      "BusinessName": h.lab.name,
      "CLIA ID": h.lic.cliaNumber,
      "LicenseNumber": h.lic.caStateId,
      "TaxID": h.lab.ein,
      "Site Address": join([h.street, h.cityStZip], ", "),
      "Print owners name and titles": join([h.owner.name, h.owner.title], ", "),
      "Date 1_af_date": h.today,
    } };
  },

  LAB183(q) {
    const h = helpers(q);
    return {
      text: {
        "Laboratory Name": h.lab.name,
        "Address": join([h.street, h.cityStZip], ", "),
        "State ID": h.lic.caStateId,
        "CLIA ID": h.lic.cliaNumber,
        "Effective Date": h.lab.effectiveDate,
        "Print Laboratory Director's Name and Title": h.dirNameTitle,
        "California Director License Number": h.dir.licenseNumber,
        "Director's direct contact number": h.dir.phone,
        "Director's Address": join([h.dir.address, h.dir.city, h.dir.state, h.dir.zip], ", "),
        "Date Signed_af_date": h.today,
      },
    };
  },

  LAB193(q) {
    const h = helpers(q);
    return { text: {
      "Facility Name": h.lab.name,
      "Current Tax ID": h.lab.ein,
      "State Lab ID": h.lic.caStateId,
      "CLIA ID": h.lic.cliaNumber,
      "Email": h.lab.email,
    } };
  },

  "LAB144-OS"(q) {
    const h = helpers(q);
    const text = {
      "Name of Laboratory": h.lab.name, "DBA": h.lab.dba,
      "TAX ID": h.lab.ein, "CLIA ID": h.lic.cliaNumber,
      "STATE ID": h.lic.caStateId, "EXPIRATION DATE": h.lic.caExpiration,
      "Physical Address: Number, Street": S(h.lab.address),
      "Physical Address: Room, suite": h.lab.suite,
      "Physical Address: City": h.lab.city, "Physical Address: State": h.lab.state,
      "Physical Address: Zip Code": h.lab.zip,
      "Physical Address: Testing Site Contact Person": h.contact.name,
      "Physical Address: Testing Site Email": h.contact.email || h.lab.email,
      "Physical Address: Testing Site Phone": h.contact.phone || h.lab.phone,
      "Mailing Address: Number, street": S(h.mail.address),
      "Mailing Address: Room/suite": h.mail.suite,
      "Mailing Address: City": h.mail.city, "Mailing Address: State": h.mail.state,
      "Mailing Address: Zip Code": h.mail.zip,
      "Business Contact Person": h.contact.name,
      "Business Email": h.contact.email || h.lab.email,
      "Business Phone": h.contact.phone || h.lab.phone,
      "Print Name Laboratory Director": h.dirFirstLast,
      "Print Name Owner or Authorized Representative": h.owner.name,
    };
    h.owners.slice(0, 5).forEach((o, i) => {
      const n = i + 1;
      text[`${n}. Percentage Owned`] = o.percent;
      text[`${n}. Owner Individual / Company`] = o.name;
      text[`${n}. Tax ID`] = o.taxId;
    });
    // Director row 1
    text["1. hours per week on site"] = h.dir.hoursPerWeek;
    text["1. Name of Laboratory Director (First, Initial, Last)"] = h.dirFirstLast;
    text["1. License Number"] = h.dir.licenseNumber;
    text["1. Association Date_af_date"] = h.dir.associationDate;
    return { text, ...lab144Checks(q) };
  },

  "LAB116-OS"(q) {
    const h = helpers(q);
    const text = {
      "Laboratory name": h.lab.name,
      "CLIA number": h.lic.cliaNumber,
      "Laboratory address": h.street,
      "Laboratory address (city)": h.lab.city,
      "Laboratory address (state)": h.lab.state,
      "Laboratory address (ZIP code)": h.lab.zip,
      "Contact Person": h.contact.name,
      "Telephone area code": S(h.lab.phone).replace(/\D/g, "").slice(0, 3),
      "Telephone number": S(h.lab.phone).replace(/\D/g, "").slice(3),
    };
    const check = [];
    // Row 1 = director, then testing personnel
    const rows = [{ firstName: h.dir.firstName, middleInitial: h.dir.middleInitial, lastName: h.dir.lastName, licenseType: h.dir.licenseType, licenseNumber: h.dir.licenseNumber, isDirector: true }]
      .concat(h.personnel);
    rows.slice(0, 20).forEach((p, i) => {
      const n = i + 1;
      text[`Personnel-last name (${n})`] = p.lastName || (p.name ? S(p.name).split(" ").pop() : "");
      text[`Personnel-first name (${n})`] = p.firstName || (p.name ? S(p.name).split(" ")[0] : "");
      text[`Personnel-middle initial (${n})`] = p.middleInitial;
      text[`License or certificate type (${n})`] = p.licenseType;
      text[`License or certificate number (${n})`] = p.licenseNumber;
      if (p.isDirector) check.push(`Director (${n})`);
    });
    return { text, check };
  },

  "LAB168-OS"(q) {
    const h = helpers(q);
    return { text: {
      "Name": h.dirFirstLast,
      "Mailing address Number Street PO Box": h.dir.address,
      "City State ZIP Code": join([h.dir.city, h.dir.state, h.dir.zip], " "),
      "Present employers  Names and Addresses": join([h.lab.name, h.street, h.cityStZip], ", "),
      "6 Employers identification numbers": h.lab.ein,
      "Name of Granting AgencyRow1": h.dir.licenseIssuer,
      "License Certificate or Registration TitleRow1": h.dir.licenseType,
      "License Certificate or Registration NumberRow1": h.dir.licenseNumber,
    } };
  },
};

// LAB 144 / 144R share most field names
function lab144Map(q, renewal) {
  const h = helpers(q);
  const text = {
    "Name of Laboratory": h.lab.name, "DBA": h.lab.dba,
    "CLIA ID": h.lic.cliaNumber, "TAX ID": h.lab.ein,
    "Physical Address (Number, Street)": S(h.lab.address),
    "Physical Room, Suite": h.lab.suite,
    "Physical City": h.lab.city, "Physical State": h.lab.state, "Physical Zip Code": h.lab.zip,
    "Testing Site Contact Person": h.contact.name,
    "Testing Site Email": h.contact.email || h.lab.email,
    "Testing Site Phone": h.contact.phone || h.lab.phone,
    "Mailing Address (Number, Street)": S(h.mail.address),
    "Mailing Room, Suite": h.mail.suite,
    "Mailing City": h.mail.city, "Mailing State": h.mail.state, "Mailing Zip Code": h.mail.zip,
    "Business Site Contact Person": h.contact.name,
    "Business Site Email": h.contact.email || h.lab.email,
    "Business Site Phone": h.contact.phone || h.lab.phone,
    "Print Name of Owner": h.owner.name,
    "Print Name of Laboratory Director": h.dirFirstLast,
  };
  if (!renewal) text["Total Estimated Annual Test Volume"] = h.lab.testVolume;
  if (renewal) {
    text["STATE ID"] = h.lic.caStateId;
    text["expiration date"] = h.lic.caExpiration;
  }
  h.owners.slice(0, 5).forEach((o, i) => {
    const n = i + 1;
    text[`ROW ${n} % OWNED`] = o.percent;
    text[`${n} Owner Name (individual or company)`] = o.name;
    text[`${n} Tax ID`] = o.taxId;
  });
  // Director row 1 = the primary director
  text["1 Hours per Week On Site"] = h.dir.hoursPerWeek;
  text["1 Name of Laboratory Director"] = h.dirFirstLast;
  text["1 License Number"] = h.dir.licenseNumber;
  text["1 Association Date"] = h.dir.associationDate;
  if (!renewal) text["1 License Type"] = h.dir.licenseType;
  return { text, ...lab144Checks(q) };
}

// Ownership / certificate checkboxes shared by LAB144, LAB144R, LAB144-OS
function lab144Checks(q) {
  const check = [];
  const radio = {};
  const ot = q.ownership?.type;
  const boxMap = {
    sole_proprietorship: "SOLE PROPRIETORSHIP", general_partnership: "GENERAL PARTNERSHIP",
    limited_partnership: "LIMITED PARTNERSHIP", llp: "LIMITED LIABILITY PARTNERS",
    llc: "LIMITED LIABILITY COMPANY", corporation: "CORPORATION",
    unincorporated_association: "UNINCORPORATED ASSOCIATION", nonprofit: "NONPROFIT - SUBMIT PROOF",
    city: "CITY", county: "COUNTY", state: "STATE", federal: "FEDERAL GOVERNMENT",
  };
  const text = {};
  if (boxMap[ot]) check.push(boxMap[ot]);
  else if (ot) { check.push("OTHER OWNERSHIP TYPE"); text["OTHER (OWNERSHIP TYPE)"] = OWNERSHIP_LABELS[ot] || q.ownership?.otherText; text["OTHER OWNERSHIP"] = OWNERSHIP_LABELS[ot] || q.ownership?.otherText; }
  const lic = q.license || {};
  if (lic.certificateType === "compliance") {
    radio["TYPE OF CERTIFICATE"] = "Certificate of Compliance";
    radio["OVERSIGHT"] = "STATE OVERSIGHT";
  } else if (lic.certificateType === "accreditation") {
    radio["TYPE OF CERTIFICATE"] = "Certificate of Accreditation";
    radio["OVERSIGHT"] = "DEEMED STATUS";
    const orgBox = { AAHHS: "AAHHS/HFAP", HFAP: "AAHHS/HFAP", AABB: "AABB", CAP: "CAP", COLA: "COLA", TJC: "TJC" }[lic.accreditingOrg];
    if (orgBox) check.push(orgBox);
  }
  return { check, radio, extraText: text };
}

function lab167Map(q) {
  const h = helpers(q);
  return { text: {
    "Name of Laboratory": h.lab.name,
    "State ID Number": h.lic.caStateId,
    "CLIA": h.lic.cliaNumber,
    "Address number street.0": h.street,
    "Address number street.1": h.lab.city,
    "State": h.lab.state, "ZIP": h.lab.zip,
    "Printed Name": h.prep.name || h.contact.name,
    "Date": h.today,
  } };
}

// ---------- Texas XFA (LiveCycle) form: inject the datasets packet ----------
const xmlEsc = (v) => S(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function buildTxDatasets(q) {
  const h = helpers(q);
  const cb = { cb1: 0, cb2: 0, cb3: 0, cb4: 0, cb5: 0 };
  let otherText = "";
  const ot = q.ownership?.type;
  if (ot === "sole_proprietorship") cb.cb1 = 1;
  else if (["general_partnership", "limited_partnership", "llp"].includes(ot)) cb.cb2 = 1;
  else if (["corporation", "llc"].includes(ot)) cb.cb3 = 1;
  else if (ot === "unincorporated_association") cb.cb4 = 1;
  else if (ot) { cb.cb5 = 1; otherText = OWNERSHIP_LABELS[ot] || S(q.ownership?.otherText); }
  const N = (v) => `<Name>${xmlEsc(v)}</Name>`;
  return `<xfa:datasets xmlns:xfa="http://www.xfa.org/schema/xfa-data/1.0/"><xfa:data><form_3225><page1><s1 xfa:dataNode="dataGroup"/><s2>${N(h.lab.name)}<DOB>${xmlEsc(h.today)}</DOB><Telephone>${xmlEsc(h.dir.phone)}</Telephone><email_address>${xmlEsc(h.prep.name || h.contact.name)}</email_address></s2><p1 xfa:dataNode="dataGroup"/><p2>${N(h.owner.name || h.lab.name)}${N(h.lic.cliaNumber)}${N(h.lab.ein)}${N(h.street)}<Texas_Counties>${xmlEsc(h.lab.county)}</Texas_Counties><States>${xmlEsc(h.lab.state)}</States>${N(h.lab.zip)}${N(h.lab.phone)}${N(h.lab.fax)}</p2><p3><p1><Table3><HeaderRow xfa:dataNode="dataGroup"/><Row1><Cell1>${xmlEsc(h.owner.name)}</Cell1><Cell2/><Cell3>${xmlEsc(h.owner.percent ? h.owner.percent + "%" : "")}</Cell3></Row1></Table3><button xfa:dataNode="dataGroup"/></p1><p2><cb1>${cb.cb1}</cb1><cb2>${cb.cb2}</cb2><cb3>${cb.cb3}</cb3><cb4>${cb.cb4}</cb4><cb5>${cb.cb5}</cb5>${N(otherText)}</p2><p3><Table3><HeaderRow xfa:dataNode="dataGroup"/><Row1><Cell1/><Cell2/><Cell3/></Row1></Table3><button xfa:dataNode="dataGroup"/></p3></p3><p4>${N(h.prep.name || h.owner.name)}${N(h.prep.title)}${N("")}${N(h.today)}</p4></page1></form_3225></xfa:data></xfa:datasets>`;
}

async function fillTxForm(q, bytes) {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const acro = doc.catalog.lookup(PDFName.of("AcroForm"));
  const xfa = acro && acro.lookup(PDFName.of("XFA"));
  if (!xfa) throw new Error("XFA packet not found");
  const xml = buildTxDatasets(q);
  const newStream = doc.context.flateStream(xml);
  const newRef = doc.context.register(newStream);
  // XFA is an array of [name, streamRef, name, streamRef, ...]
  for (let i = 0; i < xfa.size(); i += 2) {
    const name = xfa.lookup(i);
    if (name && name.decodeText && name.decodeText() === "datasets") {
      xfa.set(i + 1, newRef);
      break;
    }
  }
  return doc.save({ useObjectStreams: false });
}

// ---------- main entry ----------
export async function fillFormPdf(formId, q) {
  const def = FORM_CATALOG.find((f) => f.id === formId);
  if (!def) return null;
  const bytes = await readFile(path.join(resolveBlankDir(), def.file));

  if (formId === "TX3225") {
    const out = await fillTxForm(q || {}, bytes);
    return { bytes: out, filename: def.file, title: def.title };
  }

  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const form = doc.getForm();
  const map = MAPS[formId] ? MAPS[formId](q || {}) : { text: {} };
  const allText = { ...(map.text || {}), ...(map.extraText || {}) };

  for (const [name, value] of Object.entries(allText)) {
    const v = S(value);
    if (!v) continue;
    try {
      const field = form.getTextField(name);
      try {
        field.setText(v);
      } catch {
        // Value longer than the field's maxLength (combed boxes) — widen, then retry
        try { field.setMaxLength(v.length); field.setText(v); }
        catch { try { field.setText(v.slice(0, field.getMaxLength() || v.length)); } catch { /* skip */ } }
      }
    } catch { /* field absent — skip */ }
  }
  for (const name of map.check || []) {
    try { form.getCheckBox(name).check(); } catch { /* skip */ }
  }
  for (const [group, option] of Object.entries(map.radio || {})) {
    try { form.getRadioGroup(group).select(option); } catch { /* skip */ }
  }
  try { form.updateFieldAppearances(); } catch { /* some forms lack default fonts */ }
  const out = await doc.save({ useObjectStreams: false });
  return { bytes: out, filename: def.file, title: def.title };
}
