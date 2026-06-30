import { Module } from '@nestjs/common';
import { ActivitiesService } from '../services/activities.service';
import { ProofVerifierService } from '../services/proof-verifier.service';

@Module({
  providers: [ProofVerifierService, ActivitiesService],
  exports: [ActivitiesService, ProofVerifierService],
})
export class ActivitiesModule {}
