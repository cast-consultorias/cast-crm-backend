require('dotenv').config();

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

// Sheet names
const SHEETS = {
  LEADS:       process.env.SHEET_LEADS       || 'Leads',
  ACTIVITY:    process.env.SHEET_ACTIVITY    || 'ActivityLog',
  BLUEPRINT:   process.env.SHEET_BLUEPRINT   || 'BlueprintSessions',
  ATTACHMENTS: process.env.SHEET_ATTACHMENTS || 'Attachments',
  USERS:       process.env.SHEET_USERS       || 'Users',
  SEGUIMIENTO: process.env.SHEET_SEGUIMIENTO || 'Seguimiento',
  CLOSED_LOST: process.env.SHEET_CLOSED_LOST || 'ClosedLost',
};

// Column indices for Leads sheet (0-based)
const LEAD_COLS = {
  id:0, name:1, company:2, email:3, phone:4, country:5,
  sector:6, score:7, level:8, stage:9, valueUSD:10, probability:11,
  painType:12, projectStage:13, source:14, assignee:15, flowType:16,
  tier:17, reportIA:18, blueprintDone:19, ivcRS:20, ivcPP:21,
  ivcRT:22, ivcES:23, ivcScore:24, slaActive:25, slaStartTime:26,
  notes:27, createdAt:28, updatedAt:29, entryType:30, driveFolderId:31,
  loomUrl:32, deliverableUrl:33, nextAction:34, nextActionDate:35,
  nextActionAssignee:36, closedLostReason:37, closedLostCategory:38, recontactDate:39,
  reportContent:40, leadCode:41,
};

const LEAD_HEADERS = [
  'id','name','company','email','phone','country','sector','score','level','stage',
  'valueUSD','probability','painType','projectStage','source','assignee','flowType',
  'tier','reportIA','blueprintDone','ivcRS','ivcPP','ivcRT','ivcES','ivcScore',
  'slaActive','slaStartTime','notes','createdAt','updatedAt','entryType','driveFolderId',
  'loomUrl','deliverableUrl','nextAction','nextActionDate','nextActionAssignee',
  'closedLostReason','closedLostCategory','recontactDate','reportContent','leadCode',
];

module.exports = { SPREADSHEET_ID, SHEETS, LEAD_COLS, LEAD_HEADERS };
