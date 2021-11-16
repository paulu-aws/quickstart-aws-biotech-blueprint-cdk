import { Template, Match } from '@aws-cdk/assertions';
import * as cdk from '@aws-cdk/core';

import * as AwsStartupBlueprint from '../lib/aws-startup-blueprint-stack';

test('Blueprint Stack Created', () => {
  const app = new cdk.App();
    // WHEN
  const stack = new AwsStartupBlueprint.AwsStartupBlueprintStack(app, 'BlueprintTestStack');
  const template = Template.fromStack(stack);

});