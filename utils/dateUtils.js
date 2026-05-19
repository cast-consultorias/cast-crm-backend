const dayjs = require('dayjs');

const nowISO     = () => new Date().toISOString();
const nowDate    = () => new Date().toISOString().split('T')[0];
const addHours   = (h) => new Date(Date.now() + h * 3600 * 1000).toISOString();
const addDays    = (d) => new Date(Date.now() + d * 24 * 3600 * 1000).toISOString();
const hoursAgo   = (iso) => (Date.now() - new Date(iso).getTime()) / 3600000;
const fmtDisplay = (iso) => iso ? dayjs(iso).format('DD/MM/YYYY HH:mm') : '—';

module.exports = { nowISO, nowDate, addHours, addDays, hoursAgo, fmtDisplay };
