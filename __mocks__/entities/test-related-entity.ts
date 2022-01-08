import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
class TestRelatedEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  demo: string;
}

export default TestRelatedEntity;
