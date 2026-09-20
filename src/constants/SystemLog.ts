
export interface LogEntry {
  version: string;
  date: string;
  action: string;
  status: 'active' | 'deprecated' | 'planned';
  description: string;
}

export const SYSTEM_LOG: LogEntry[] = [
  {
    version: '1.1.8',
    date: '2026-09-15',
    action: 'GEMINI_NATIVE_RESTORATION',
    status: 'deprecated',
    description: 'Decommissioned OpenRouter. Fully migrated TRINITY to native Gemini 3 Pro API.'
  },
  {
    version: '1.1.9',
    date: '2026-09-15',
    action: 'HARMONY_PROTOCOL_V1',
    status: 'active',
    description: 'Implemented ∇ε_Total protocol logic in system instructions. Optimized Edge Functions with timeouts and direct /v1/ routing.'
  }
,
  {
    version: '1.2.0',
    date: '2026-09-20',
    action: 'PROVIDER_SWITCH',
    status: 'active',
    description: 'Gemini SDK removed. OpenRouter first, LiteRouter as fallback; a provider that looks configured can still be unconfigured — judge by the live reply.'
  },
  {
    version: '1.2.1',
    date: '2026-09-20',
    action: 'ASSISTANT_IDENTITY',
    status: 'active',
    description: 'Админский ассистент переименован: TRINITY → Антон. Имя одно на витрину и панель; права владельца словами в чате не подтверждаются.'
  }
];
