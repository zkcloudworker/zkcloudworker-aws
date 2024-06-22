import {
  LightsailClient,
  GetInstanceStateCommand,
  RebootInstanceCommand,
  GetInstanceMetricDataCommand,
  GetInstanceMetricDataCommandInput,
} from "@aws-sdk/client-lightsail";

export async function restartNatsServer() {
  const client = new LightsailClient();
  const params = {
    instanceName: "Celestia",
  };
  const command = new GetInstanceStateCommand(params);
  const data = await client.send(command);
  const running = data.state?.name === "running";
  const time = Date.now();
  const metricParams = {
    instanceName: "Celestia",
    metricName: "StatusCheckFailed",
    period: 60,
    startTime: new Date(time - 60 * 1000),
    endTime: new Date(time),
    unit: "Count",
    statistics: ["Sum"],
  } as GetInstanceMetricDataCommandInput;
  const metric = new GetInstanceMetricDataCommand(metricParams);
  const metricOutput = await client.send(metric);
  //console.log("Metric data:", metricOutput);
  const sum = metricOutput.metricData
    ? metricOutput.metricData[0]?.sum ?? 0
    : 0;

  if (running === false || sum > 0) {
    console.error("Rebooting the Celestia instance", {
      running,
      sum,
      metricOutput,
      state: data.state,
    });
    const reboot = new RebootInstanceCommand(params);
    const result = await client.send(reboot);
    console.log("Reboot result:", result);
  }
}
