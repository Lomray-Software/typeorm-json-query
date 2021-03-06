import { CEntity } from '@lomray/microservices-types';
import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import TestRelatedEntity from './test-related-entity';

@Entity()
class TestEntity extends CEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  param: string;

  @OneToOne(() => TestRelatedEntity)
  @JoinColumn()
  testRelation: TestRelatedEntity;
}

export default TestEntity;
