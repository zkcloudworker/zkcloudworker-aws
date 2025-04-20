import { Table } from "./table.js";
import { FileData } from "../model/fileData.js";

export class FilesTable extends Table<FileData> {
  public async listFiles(id: string): Promise<FileData[]> {
    try {
      const files: FileData[] = await this.queryData("id = :id", {
        ":id": id,
      });
      console.log("listFiles", files);
      return files ?? [];
    } catch (error: any) {
      console.error("listFiles error", id, error);
      return [];
    }
  }
}
