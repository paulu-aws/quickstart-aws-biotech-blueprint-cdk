import core = require("@aws-cdk/core");
import s3 = require("@aws-cdk/aws-s3");
import ec2 = require("@aws-cdk/aws-ec2");
import log = require('@aws-cdk/aws-logs');
import iam = require("@aws-cdk/aws-iam");
import cfn = require("@aws-cdk/aws-cloudformation");
import lambda = require("@aws-cdk/aws-lambda");

import * as fs from 'fs';
import { CfnAccessPoint } from "@aws-cdk/aws-s3";

export class BlueprintVpcs extends core.Construct {
  
  public readonly ProductionVpc: ec2.Vpc;
  public readonly ManagmentVPC: ec2.Vpc;
  public readonly DevelopmentVpc: ec2.Vpc;
  public readonly MangementVpcDnsIp: string;
  
  constructor(scope: core.Construct, id: string, props: core.StackProps) {
    super(scope, id);

    this.ProductionVpc = new ec2.Vpc(this, 'Production', {
        cidr: '10.50.0.0/16',          
        maxAzs: 2,    
        natGateways: 1,
        subnetConfiguration: [
          { 
            cidrMask: 23,
            subnetType: ec2.SubnetType.PUBLIC,    
            name: 'DMZ',
          },
          {
            cidrMask: 23,
            name: 'Application',
            subnetType: ec2.SubnetType.PRIVATE,
          },
          {
            cidrMask: 23,
            name: 'Database',
            subnetType: ec2.SubnetType.ISOLATED,    
          }
        ],
        gatewayEndpoints: {
          S3: {
            service: ec2.GatewayVpcEndpointAwsService.S3,
          }
        }
    });
  
    this.DevelopmentVpc = new ec2.Vpc(this, 'Development', {
        cidr: '10.60.0.0/16',          
        maxAzs: 2,    
        natGateways: 1,
        subnetConfiguration: [
          {
            cidrMask: 23,
            subnetType: ec2.SubnetType.PUBLIC,    
            name: 'DMZ',
          },
          {
            cidrMask: 23,
            name: 'Application',
            subnetType: ec2.SubnetType.PRIVATE,
          },
          {
            cidrMask: 23,
            name: 'Database',
            subnetType: ec2.SubnetType.ISOLATED,    
          }
        ],
        gatewayEndpoints: {
          S3: {
            service: ec2.GatewayVpcEndpointAwsService.S3,
          }
        }
    });
  

    let managmentCidr = '10.70.0.0/16';

    let baseRangeAndMask = managmentCidr.split('/');
    let baseRangeOctets = baseRangeAndMask[0].split('.');
    let baseOctetPlusTwo = Number(baseRangeOctets[3]) + 2;
    this.MangementVpcDnsIp = `${baseRangeOctets[0]}.${baseRangeOctets[1]}.${baseRangeOctets[2]}.${baseOctetPlusTwo}`;

    this.ManagmentVPC = new ec2.Vpc(this, 'Managment', {
        cidr: managmentCidr,          
        maxAzs: 2,    
        natGateways: 1,
        subnetConfiguration: [
          {
            cidrMask: 23,
            subnetType: ec2.SubnetType.PUBLIC,    
            name: 'DMZ',
          },
          {
            cidrMask: 23,
            name: 'Application',
            subnetType: ec2.SubnetType.PRIVATE,
          }
        ]
    });
      
      
    
    const prodLogGroup = new log.LogGroup(this, 'ProductionVpcLogGroup');
    const mgmtLogGroup = new log.LogGroup(this, 'MgmtVpcLogGroup');
    const devLogGroup = new log.LogGroup(this, 'DevVpcLogGroup');
    
    const vpcLogGroupRole = new iam.Role(this, 'vpcLogGroupRole', {
      assumedBy: new iam.ServicePrincipal('vpc-flow-logs.amazonaws.com')
    });
    
    new ec2.FlowLog(this, 'ProdFlowLog', {
      resourceType: ec2.FlowLogResourceType.fromVpc(this.ProductionVpc),
      destination: ec2.FlowLogDestination.toCloudWatchLogs(prodLogGroup, vpcLogGroupRole)
    });      
    new ec2.FlowLog(this, 'MgmtFlowLog', {
      resourceType: ec2.FlowLogResourceType.fromVpc(this.ManagmentVPC),
      destination: ec2.FlowLogDestination.toCloudWatchLogs(mgmtLogGroup, vpcLogGroupRole)
    });     
    new ec2.FlowLog(this, 'DevlowLog', {
      resourceType: ec2.FlowLogResourceType.fromVpc(this.DevelopmentVpc),
      destination: ec2.FlowLogDestination.toCloudWatchLogs(devLogGroup, vpcLogGroupRole)
    });     
    
    const retentionRole = new iam.Role(this, 'retentionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com')
    });
    
    retentionRole.addToPolicy(new iam.PolicyStatement({
      resources: ["*"],
      actions: ['logs:CreateLogGroup'] 
    }));
    
    
    const prodLogRtention = new log.LogRetention(this, 'ProdLogRetention', {
      logGroupName: prodLogGroup.logGroupName,
      retention: log.RetentionDays.ONE_MONTH,
      logRetentionRetryOptions: {
        base: core.Duration.minutes(30),
        maxRetries: 3,
      },
      role: retentionRole,
    });
    
    const mgmtLogRtention = new log.LogRetention(this, 'MgmtLogRtention', {
      logGroupName: mgmtLogGroup.logGroupName,
      retention: log.RetentionDays.TWO_WEEKS,
      logRetentionRetryOptions: {
        base: core.Duration.minutes(30),
        maxRetries: 3,
      },
      role: vpcLogGroupRole,
    });
    
    const devLogRtention = new log.LogRetention(this, 'DevLogRtention', {
      logGroupName: devLogGroup.logGroupName,
      retention: log.RetentionDays.THREE_DAYS,
      logRetentionRetryOptions: {
        base: core.Duration.minutes(30),
        maxRetries: 3,
      },
      role: vpcLogGroupRole,
    });
    
    
    
      
    const mgmtToProductionPeering = new ec2.CfnVPCPeeringConnection(this, 'ManagmentToProductionPeering', {
        vpcId: this.ManagmentVPC.vpcId,
        peerVpcId: this.ProductionVpc.vpcId
    });
  
    const mgmtToDevPeering = new ec2.CfnVPCPeeringConnection(this, 'ManagmentToDevelopmentPeering', {
        vpcId: this.ManagmentVPC.vpcId,
        peerVpcId: this.DevelopmentVpc.vpcId
    });
  
    const publicSubnetSelection = { subnetType: ec2.SubnetType.PUBLIC };
    const privateSubnetSelection = { subnetType: ec2.SubnetType.PRIVATE };
    const isolatedSubnetSelection = { subnetType: ec2.SubnetType.ISOLATED };
    

    // Management <-> Dev

    this.createRoutesForSubnetClass(`mgmtPublicToDev`,this.ManagmentVPC, publicSubnetSelection, this.DevelopmentVpc, mgmtToDevPeering );
    this.createRoutesForSubnetClass(`mgmtPrivateToDev`,this.ManagmentVPC, privateSubnetSelection, this.DevelopmentVpc, mgmtToDevPeering );
    this.createRoutesForSubnetClass(`devPublicToMgmt`,this.DevelopmentVpc, publicSubnetSelection, this.ManagmentVPC, mgmtToDevPeering );
    this.createRoutesForSubnetClass(`devPrivateToMgmt`,this.DevelopmentVpc, privateSubnetSelection, this.ManagmentVPC, mgmtToDevPeering );
    this.createRoutesForSubnetClass(`devIsolatedToMgmt`,this.DevelopmentVpc, isolatedSubnetSelection, this.ManagmentVPC, mgmtToDevPeering );

    // Management <-> Prod

    this.createRoutesForSubnetClass(`mgmtPublicToProd`,this.ManagmentVPC, publicSubnetSelection, this.ProductionVpc, mgmtToProductionPeering );
    this.createRoutesForSubnetClass(`mgmtPrivateToProd`,this.ManagmentVPC, privateSubnetSelection, this.ProductionVpc, mgmtToProductionPeering );
    this.createRoutesForSubnetClass(`prodPublicToMgmt`,this.ProductionVpc, publicSubnetSelection, this.ManagmentVPC, mgmtToProductionPeering );
    this.createRoutesForSubnetClass(`prodPrivateToMgmt`,this.ProductionVpc, privateSubnetSelection, this.ManagmentVPC, mgmtToProductionPeering );
    //this.createRoutesForSubnetClass(`ProdIsolatedToMgmt`,developmentVPC, isolatedSubnetSelection, managementVPC, mgmtToDevPeering );
  }

  private createRoutesForSubnetClass(name: string, sourceVPC: ec2.Vpc, sourceSubnetType: any, destinationVPC: ec2.Vpc, peeringConnection: ec2.CfnVPCPeeringConnection ){
    
    sourceVPC.selectSubnets(sourceSubnetType).subnets.forEach((subnet, index) => {
      new ec2.CfnRoute(this, `${name}-${index}`, {
        routeTableId: subnet.routeTable.routeTableId,
        destinationCidrBlock: destinationVPC.vpcCidrBlock,
        vpcPeeringConnectionId: peeringConnection.ref
      });
    });
  }
}