import { Table } from "./table";
import { WorkersData } from "../model/workersData";

export class Workers extends Table<WorkersData> {
  async timeUsed(params: {
    developer: string;
    repo: string;
    count: number;
  }): Promise<void> {
    const { developer, repo, count } = params;
    await this.updateData(
      {
        developer,
        repo,
      },
      {
        "#T": "timeUsed",
        "#C": "countUsed",
      },
      {
        ":t": Date.now(),
        ":c": count + 1,
      },
      "set #T = :t, #C = :c"
    );
  }
}
