const STAGES = [
  { id:'01', name:'Lead Recibido',      group:'Entrada'    },
  { id:'02', name:'Análisis IA',        group:'Entrada'    },
  { id:'03', name:'Reporte IA',         group:'Entrada'    },
  { id:'04', name:'Contacto',           group:'Contacto'   },
  { id:'05', name:'Prep. Sesión',       group:'Contacto'   },
  { id:'06', name:'Sesión en Progreso', group:'Sesión'     },
  { id:'07', name:'Ruta Validada',      group:'Sesión'     },
  { id:'08', name:'Investigación 48h',  group:'Entregable' },
  { id:'09', name:'Entregable Enviado', group:'Entregable' },
  { id:'10', name:'2da Reunión',        group:'Propuesta'  },
  { id:'11', name:'Seguimiento DMU',    group:'Propuesta'  },
  { id:'12', name:'Comité',            group:'Cierre'     },
  { id:'13', name:'Negociación',       group:'Cierre'     },
  { id:'14', name:'Closed Won',        group:'Ganado'     },
  { id:'15', name:'Onboarding',         group:'Ganado'     },
  { id:'16', name:'En Pausa',           group:'Especial'   },
  { id:'17', name:'Nurturing',          group:'Especial'   },
  { id:'18', name:'Closed Lost',        group:'Perdido'    },
];

const VELOCITY_MAP = { muy_rapido:2, rapido:4, moderado:7, sin_prisa:10 };
const INVOLVEMENT_MAP = { muy_involucrado:2, moderado:4, supervision:7, delegar:10 };

const INVESTMENT_TIER = {
  tier_0: null,
  tier_1: 'Esencial',
  tier_2: 'Pro',
  tier_3: 'Premium',
};

module.exports = { STAGES, VELOCITY_MAP, INVOLVEMENT_MAP, INVESTMENT_TIER };
