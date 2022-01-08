import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import TestRelatedEntity from './test-related-entity';

@Entity()
class TestEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  param: string;

  @OneToOne(() => TestRelatedEntity)
  @JoinColumn()
  testRelation: TestRelatedEntity;
}

export default TestEntity;
