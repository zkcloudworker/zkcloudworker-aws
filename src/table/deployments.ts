import { Table } from "./table";
import { DeploymentsData } from "../model/deploymentsData";

export class Deployments extends Table<DeploymentsData> {
  async add(params: {
    developer: string;
    repo: string;
    timestamp: number;
    version: string;
    size: number;
    success: boolean;
    error?: string;
  }): Promise<void> {
    const { developer, repo, timestamp, version, size, success, error } =
      params;
    await this.create({
      agent: `${developer}:${repo}`,
      timestamp,
      version,
      size,
      success,
      error,
    });
  }

  public async queryDeployments(params: {
    developer: string;
    repo: string;
  }): Promise<DeploymentsData[]> {
    const { developer, repo } = params;
    return await this.queryData(
      "agent = :agent",
      { ":agent": `${developer}:${repo}` },
      "agent, timestamp, version, size, success, error"
    );
  }
}
