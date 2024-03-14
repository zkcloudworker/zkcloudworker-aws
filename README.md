# zkCloudWorker AWS

### Configuring AWS VPC

This repo uses EFS storage running in VPC to store the prover keys. To create VPC access for lambda functions:

- Add EFS
- Add DynamoDB VPC gateway
- Add S3 VPC gateway
- Add lambda VPC interface
- Add NAT to VPC
- Configure VPC in the functions setting in serverless.yml
  Use serverless.yml in this repo as an example, and this [guide](https://medium.com/@pra4mesh/internet-access-to-aws-lambda-in-a-vpc-6f7b65845f1d)
