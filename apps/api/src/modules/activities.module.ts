import { Module } from '@nestjs/common';
import { ActivitiesService } from '../services/activities.service';
import { GuidanceService } from '../services/guidance.service';
import { ProofVerifierService } from '../services/proof-verifier.service';

@Module({
  providers: [ProofVerifierService, ActivitiesService, GuidanceService],
  exports: [ActivitiesService, ProofVerifierService, GuidanceService],
})
export class ActivitiesModule {}
