const dayjs = require('dayjs');

const toBool = v => v === true || v === 'TRUE' || v === 'true' || v === '1';
const toNum  = v => v === '' || v == null ? null : parseFloat(v);
const toInt  = v => v === '' || v == null ? 0    : parseInt(v) || 0;
const toStr  = v => v == null ? '' : String(v);

function rowToLead(row) {
  if (!row || !row[0]) return null;
  return {
    id:              row[0],
    name:            toStr(row[1]),
    company:         toStr(row[2]),
    email:           toStr(row[3]),
    phone:           toStr(row[4]),
    country:         toStr(row[5]),
    sector:          toStr(row[6]),
    score:           toInt(row[7]),
    level:           toStr(row[8]),
    stage:           toStr(row[9]),
    valueUSD:        toInt(row[10]),
    probability:     toInt(row[11]),
    painType:        toStr(row[12]),
    projectStage:    toStr(row[13]),
    source:          toStr(row[14]),
    assignee:        toStr(row[15]),
    flowType:        row[16]||null,
    tier:            row[17]||null,
    reportIA:        toBool(row[18]),
    blueprintDone:   toBool(row[19]),
    ivcRS:           toNum(row[20])||0,
    ivcPP:           toNum(row[21])||0,
    ivcRT:           toNum(row[22])||0,
    ivcES:           toNum(row[23])||0,
    ivcScore:        toNum(row[24]),
    slaActive:       toBool(row[25]),
    slaStartTime:    row[26]||null,
    notes:           toStr(row[27]),
    createdAt:       toStr(row[28]),
    updatedAt:       toStr(row[29]),
    entryType:       toStr(row[30])||'automatic',
    driveFolderId:   row[31]||null,
    loomUrl:         row[32]||null,
    deliverableUrl:  row[33]||null,
    nextAction:      toStr(row[34]),
    nextActionDate:  row[35]||null,
    nextActionAssignee: toStr(row[36]),
    closedLostReason:   row[37]||null,
    closedLostCategory: row[38]||null,
    recontactDate:      row[39]||null,
  };
}

function leadToRow(lead) {
  return [
    lead.id, lead.name, lead.company, lead.email, lead.phone,
    lead.country, lead.sector, lead.score, lead.level, lead.stage,
    lead.valueUSD, lead.probability, lead.painType, lead.projectStage,
    lead.source, lead.assignee, lead.flowType||'', lead.tier||'',
    lead.reportIA?'TRUE':'FALSE', lead.blueprintDone?'TRUE':'FALSE',
    lead.ivcRS||0, lead.ivcPP||0, lead.ivcRT||0, lead.ivcES||0,
    lead.ivcScore||'', lead.slaActive?'TRUE':'FALSE', lead.slaStartTime||'',
    lead.notes||'', lead.createdAt, lead.updatedAt, lead.entryType||'automatic',
    lead.driveFolderId||'', lead.loomUrl||'', lead.deliverableUrl||'',
    lead.nextAction||'', lead.nextActionDate||'', lead.nextActionAssignee||'',
    lead.closedLostReason||'', lead.closedLostCategory||'', lead.recontactDate||'',
  ];
}

function rowToActivity(row) {
  if (!row || !row[0]) return null;
  return { id:row[0], leadId:row[1], timestamp:row[2], userId:row[3], userName:row[4], userRole:row[5], action:row[6], detail:row[7], stageAt:row[8], ipAddress:row[9] };
}

function rowToUser(row) {
  if (!row || !row[0]) return null;
  return { id:row[0], email:row[1], passwordHash:row[2], name:row[3], role:row[4], isCEO:toBool(row[5]), active:toBool(row[6]), createdAt:row[7], lastLogin:row[8], color:row[9], initials:row[10] };
}

module.exports = { toBool, toNum, toInt, toStr, rowToLead, leadToRow, rowToActivity, rowToUser };
