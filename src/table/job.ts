import Jobs from "./jobs";

export class Job {
  table: string;
  id: string;
  task: string;
  jobName: string;
  jobId?: string;
  timeStarted: number;
  constructor(params: {
    id: string;
    task: string;
    jobName?: string;
    table?: string;
  }) {
    const { id, task, jobName, table } = params;
    this.table = table ?? process.env.JOBS_TABLE!;
    this.task = task;
    this.jobName = jobName ?? "AI";
    this.id = id;
    this.timeStarted = Date.now();
  }

  public async start(): Promise<string | undefined> {
    const jobs = new Jobs(this.table);
    const jobId = await jobs.createJob({
      username: this.id,
      developer: "@dfst",
      jobName: this.jobName,
      task: this.task,
      args: [],
      jobData: [],
      isStarted: true,
      timeStarted: this.timeStarted,
      txNumber: 0,
    });
    this.jobId = jobId;
    return jobId;
  }
  public async finish(result: string): Promise<void> {
    const jobs = new Jobs(this.table);
    if (this.jobId === undefined) throw new Error("jobId is undefined");
    await jobs.updateStatus({
      username: this.id,
      jobId: this.jobId,
      status: "finished",
      result,
      billedDuration: Date.now() - this.timeStarted,
    });
  }

  public async failed(error: string): Promise<void> {
    const jobs = new Jobs(this.table);
    if (this.jobId === undefined) throw new Error("jobId is undefined");
    await jobs.updateStatus({
      username: this.id,
      jobId: this.jobId,
      status: "failed",
      result: error,
      billedDuration: Date.now() - this.timeStarted,
    });
  }
}
