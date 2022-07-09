import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { CEntity } from '@src/index';

@Entity()
class TestRelatedEntity extends CEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  demo: string;
}

export default TestRelatedEntity;
