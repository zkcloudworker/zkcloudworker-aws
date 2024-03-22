# zkCloudWorker AWS

## Configuring AWS VPC

This repo uses EFS storage running in VPC to store the prover keys. To create VPC access for lambda functions:

- Add EFS
- Add DynamoDB VPC gateway
- Add S3 VPC gateway
- Add lambda VPC interface
- Add NAT to VPC
- Configure VPC in the functions setting in serverless.yml
  Use serverless.yml in this repo as an example, and this [guide](https://medium.com/@pra4mesh/internet-access-to-aws-lambda-in-a-vpc-6f7b65845f1d)

### Creating VPC

VPC > Create VPC > VPC and more
Name: zk-vpc
IPv4 CIDR block: 10.0.0.0/26
IPv6 CIDR block: No IPv6 CIDR block
Tenancy: Default
Number of Availability Zones (AZs): 2 (1a and 1b)
Number of public subnets: 2
Number of private subnets: 2
NAT gateways: In 1 AZ
VPC endpoints: S3 Gateway

### Creating EFS disk

Amazon EFS > File systems > Create file system
Name: zk-efs
VPC: zk-vpc-vpc
Press button Customize
File system type: Regional
Enable automatic backups: true
Enable encryption of data at rest: false
Transition into Standard: On first access

### Creating EFS access point

Amazon EFS > Access points > Create access point
File system: zk-efs
Name: zk-efs-ap
Root directory path : /efs

POSIX user
User ID
1000
Group ID
1000

Root directory creation permissions
Owner user ID
1000
Owner group ID
1000
Permissions
0777
