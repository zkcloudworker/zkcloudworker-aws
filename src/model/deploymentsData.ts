export interface DeploymentsData {
  agent: string;
  timestamp: number;
  version: string;
  size: number;
  success: boolean;
  error?: string;
}
