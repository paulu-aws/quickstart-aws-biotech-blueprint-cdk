# AWS DiGAV Blueprint

This Quick Start is for customers who may need to comply with the Regulation on the Requirements and the Process for the Examination of the Eligibility of Digital Health Applications for Reimbursement by the State Health Schemes or Digitale Gesundheitsanwendungen-Verordnung (referred to as DiGAV) „DiGAV“).

The Blueprint's core landing zone builds out a secure home for your workloads in under 15 minutes. That includes identity management and  access control, encryption, VPN, network isolation, logging, alarms, DNS, and built-in compliance auditing.  The key feature of this Blueprint is the automated enforcement of a policy that restricts access to AWS regions that fall within the European Economic Area (EEA).  As of March 2021 that includes: Frankfurt, Paris, Ireland, Milan, & Stockholm.

![Blueprint Diagram](https://d1i29iyx07ydzp.cloudfront.net/digav/DiGAVBluePrint.png)

## Disclaimer

Language about how this Blueprint is for examples only, it does not ensure DiGAV compliance.  Customers are responsible for ensuring their environments meet the necessary requirements.

## Region Restriction
![Region Diagram](https://d1i29iyx07ydzp.cloudfront.net/digav/DiGAVBluePrint-Region.png)

The region restriction is enforced through one of two ways depending on your AWS configuration.

### Organization Service Control Policy

If your AWS account is a member of an Organization, the Blueprint will create and attach a Service Control Policy (SCP) that limits access within the account to the regions listed.  This SCP is located [here](/scripts/DiGAVSCP.json) and can be modified to fit your needs.  For example, it can be made to be more restrictive than the 5 default regions.  The SCP also includes a conditional statement that allows for a specific IAM role to be excluded from the policy if necessary.

### Identity and Access Management Permissions Boundary Policy

If your account is not a member of an Organization, one will be created as part of this Blueprint.  There is no additional cost for creating an Organization, but AWS recommends using Organizations to help organize and manage accounts.  This configuration will allow for improvement options when customers scale beyond the first account.  The account where this Blueprint is executed will become the root account for that new Organization.  However, since Service Control Policies cannot be applied at the root account this Blueprint will also create an Identity and Access Management (IAM) policy that can be used as a [Permissions Boundary](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_boundaries.html).  The permissions boundary policy sets the maximum level of permissions available to users, including the regions that can be used.  The policy is located [here](/scripts/DiGAVIAM.json) and can be modified to fit your needs.  The default policy includes elements that prevent modification of the policy itself when it is applied, which will prevent IAM principals from circumventing the restriction.

The policy is enforced through the use of an [AWS Config custom rule](https://docs.aws.amazon.com/config/latest/developerguide/evaluate-config_develop-rules.html).  This rule will evaluate all IAM principals and mark them as non-compliant if the policy is not attached as a permission boundary.  When new IAM principals are created it will also automate the attachment of the boundary.

*Note*:  The boundary policy includes a policy statement that if a principal who has the boundary attached creates a new principal the boundary must be attached at the time of creation or an access denied error will occur.

### Other Region Requirements

The Blueprint uses AWS permission tools to restrict access to the AWS regions within the EEA.  However, it is the customers responsibility to ensure that the proper restrictions are in place to prevent access from employees or other users who may not be connecting from an EEA country in accordance with the DiGAV regulations.

## Install instructions

The DiGAV Blueprint is built with the AWS CDK which allows for two deployment options. 

If you just want to get going ASAP, follow the CloudFormation Deployment option (1).

If you prefer using the awesome [AWS CDK](https://aws.amazon.com/cdk/), follow the CDK Deployment option (2).

Both deployment options take about 7 minutes to complete and create the exact same resources. The primary difference is that the AWS CDK option takes a little more time to initially setup (<5 min), but the CDK code is easier to maintain overtime compared to the raw CloudFormation markup in option 1.

### Option 1) CloudFormation Only Deployment

Download the pre-synthed CloudFormation Template (right click, Save As) *NEED LINK* and use the [AWS CloudFormation Web Console](https://console.aws.amazon.com/cloudformation/home?#/stacks/create/template) to deploy it. Should take ~ 7 min.

### Option 2) AWS CDK Deployment

```bash
git clone *NEED REPO LINK*
cd *NEED FOLDER NAME*
npm install
npm run build 
cdk bootstrap
```

Feel free to make any changes you see fit. For example, you might want to use different VPC CIDR ranges (`aws-vpcs.ts`) or a different internal DNS apex (`aws-dns.ts` defaults to corp). 

When you are ready, to deploy or update the blueprint's architecture in the future, you just need to run.

```bash 
npm run build && cdk deploy
```

## Connect to the VPN

In order for you to route into the private subnets in the VPCs, you need to connect to the VPN. The blueprint has deployed a client vpn endpoint in the Management vpc that will NAT traffic over peering connections into the Production and Development vpcs. We are using the Management VPC as a hub VPC for networking into other VPCs. The Development and Production environments are designed to NOT be able to communicate with each other.

![VPN Diagram](http://devspacepaul.s3.us-west-2.amazonaws.com/startupblueprints/VPNRoutingDiagram.png)

Once the deployment is complete, go to the AWS VPC web console, and scroll down to the "Client VPN Endpoints" section. Select the Client VPN Endpoint listed and click the "Download Client Configuration" button. Your browser will download a `downloaded-client-config.ovpn` file.

Now go to the AWS S3 web console and open the bucket prefixed `awsstartupblueprintstack-clientvpnvpnconfigbucket*`. You will see 5 files listed. Download the `client1.domain.tld.key` and `client1.domain.tld.crt`. The other three files are the CA chain and server key/cert. You will need those if you want to create additional client certificates later on. For now, you just need `client1.domain.tld.key` and `client1.domain.tld.crt`.

At this point we have to make some tweaks to the `downloaded-client-config.ovpn` file so open it in a text editor:

Add the following lines to the bottom of the file:

```
<cert>
Contents of client certificate (client1.domain.tld.crt) file
</cert>

<key>
Contents of private key (client1.domain.tld.key) file
</key>
```

Save the `downloaded-client-config.ovpn`. You should be able to open/import that file with any OpenVPN client. You can find instructions for using the [AWS VPN Client](https://docs.aws.amazon.com/vpn/latest/clientvpn-user/connect-aws-client-vpn-connect.html) or the [official OpenVPN client](https://docs.aws.amazon.com/vpn/latest/clientvpn-user/connect.html) for Mac/Windows/Linux on our docs pages.

## Where to go from here?

Once you are connected to the VPN, you essentially have a private encrypted channel into your new VPCs. You can now connect to any resources you launch into your VPCs using **private** IP addresses without having to hassle with insecure/public bastion hosts. You can also utilize the private DNS setup in the `.corp` hosted zone in Route 53 with any private resources you create. For example, you may decide to launch a development server that gets a private IP like 10.60.0.198. Instead of you having to remember that IP, you can create an 'A' record in the `.corp` hosted zone for `pauls-machine.corp` and map it to the private IP. Resources in all three VPCs and clients connected to the Client VPN Endpoint will then all be able to resolve `pauls-machine.corp` from a browser, api call, etc. 

### Launching stuff. How to think about the VPCS and Subnets?

These are the primary landing zones for resources you deploy into AWS. You can think of VPCs as houses and the subnets as rooms. When you deploy a load balancer, EC2 instance, RDS databases, etc you will need to tell AWS what VPC and subnet it should deploy into. 

If the resource you want to deploy is for Production or Development purposes, make sure to use the Production or Development VPC. Separating the Production and Development VPCs allows you to manage the environments with different levels of controls and restrictions. 

You want to use the Management VPC only for resources that more operational in nature, like a DevOps tool, active directory, security appliance, etc. For example, the Blueprint deploys the Client VPN Endpoint into the Management VPC.

All three VPCs have similar classes of subnets. Public, Private, and Isolated. When you are deploying a resource, if the resource needs to be publically addressable by the internet at large, you need to specify the public subnet. Ideally, this should only ever be things like AWS application load balancers (ALB). If you are deploying an application server, that should never be directly internet facing (but perhaps sits behind an ALB), that still needs outbound internet access, then use a private subnet. If you are deploying a sensitive resource like a database that should only be addressable to your internal networks and needs no outbound internet access, use the isolated subnets. 

**Why are there two subnets of the same class in each VPC?** This is an important requirement for high availability on AWS. Each subnet of the same class is in a different availability zone, which is to say a physically distinct data center. In the event of an availability zone outage, having another subnet in another availability zone allows your service or AWS services to cleanly failover. For example AWS auto scaling, RDS multi-az, and the Client VPN Endpoint all take advantage of multi-az capability for clean failover in the event of a physical disaster. Outside of the subnets being in different AZ, subnets of the same class are identical from a networking perspective, it really does not matter which one you choose.

### Give me an example?

In short, when you are deploying a VPC aware resource into AWS (ALB, EC2, RDS, etc), consider first the VPC it should belong to then consider its level of isolation. Here are some examples:

* Need a server where I'm going to test out installing an application to test out on my own or show to a coworker 
    * Development VPC, Private Subnet
* Restoring an RDS snapshot in Development into Production
    * Production VPC, Isolated Subnet
* Launching an application load balancer to try installing a custom TLS certificate
    * Development VPC, Public Subnet
* Standing up a DevOps tool like Jenkins to automate deployments into Production and Development 
    * Management VPC, Private Subnet
* Standing up and Okta Cloud Connect appliance or Active Directory
    * Management VPC, Private Subnet

### Illustrated example

Here is what a conventional n-tier application might look like in the Blueprint architecture.

![SaaS Example Diagram](http://devspacepaul.s3.us-west-2.amazonaws.com/startupblueprints/BlueprintDiagramSAAS.png)


## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the Apache 2.0 License. See the LICENSE file.

## Notices
This document is provided for informational purposes only. It represents AWS’s current product offerings and practices as of the date of issue of this document, which are subject to change without notice. Customers are responsible for making their own independent assessment of the information in this document and any use of AWS’s products or services, each of which is provided “as is” without warranty of any kind, whether expressed or implied. This document does not create any warranties, representations, contractual commitments, conditions, or assurances from AWS, its affiliates, suppliers, or licensors. The responsibilities and liabilities of AWS to its customers are controlled by AWS agreements, and this document is not part of, nor does it modify, any agreement between AWS and its customers.

The software included with this paper is licensed under the Apache License, version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at http://aws.amazon.com/apache2.0/ or in the accompanying "license" file. This code is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either expressed or implied. See the License for specific language governing permissions and limitations.


