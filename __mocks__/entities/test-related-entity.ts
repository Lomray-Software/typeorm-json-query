import { CEntity } from '@lomray/microservices-types';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
class TestRelatedEntity extends CEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  demo: string;
}

export default TestRelatedEntity;
