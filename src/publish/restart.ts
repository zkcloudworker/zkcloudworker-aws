import {
  LightsailClient,
  //GetInstanceStateCommand,
  RebootInstanceCommand,
  GetInstanceMetricDataCommand,
  GetInstanceMetricDataCommandInput,
} from "@aws-sdk/client-lightsail";
import { sleep } from "../cloud";

export async function restartNatsServer() {
  const client = new LightsailClient();
  /*
  const params = {
    instanceName: "Celestia",
  };
  const command = new GetInstanceStateCommand(params);
  const data = await client.send(command);
  //console.log("Instance state:", data);
  const running = data.state?.name === "running";
  */
  const time = Date.now();
  const metricParams = {
    instanceName: "Celestia",
    metricName: "StatusCheckFailed",
    period: 60,
    startTime: new Date(time - 240 * 1000),
    endTime: new Date(time),
    unit: "Count",
    statistics: ["Sum"],
  } as GetInstanceMetricDataCommandInput;
  const metric = new GetInstanceMetricDataCommand(metricParams);
  let count = 0;
  while (count < 5) {
    const metricOutput = await client.send(metric);
    if (count > 0) {
      console.log("Metric output:", {
        metricOutput,
        metricData: metricOutput.metricData,
      });
    }
    if (
      metricOutput.metricData === undefined ||
      metricOutput.metricData[0]?.sum === undefined
    ) {
      console.error("Metric data is undefined", {
        metricOutput,
        metricData: metricOutput.metricData,
      });
      await sleep(1000);
      count++;
      continue;
    }
    //console.log("Metric data:", metricOutput);
    const sum = metricOutput.metricData
      ? metricOutput.metricData[0]?.sum ?? 0
      : 0;

    //console.log("Sum:", sum);
    if (sum > 0) {
      console.error("Rebooting the Celestia instance", {
        sum,
        metricData: metricOutput.metricData,
      });
      const rebootParams = {
        instanceName: "Celestia",
      };
      const reboot = new RebootInstanceCommand(rebootParams);
      const result = await client.send(reboot);
      console.log("Reboot result:", result);
    }
    return;
  }
}
