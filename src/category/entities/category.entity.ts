import { User } from 'src/user/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  Unique,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Card } from '../../card/entities/card.entity';

@Entity()
@Unique(['name', 'user'])
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column()
  sourceLanguage!: string;

  @Column()
  targetLanguage!: string;

  @ManyToOne(() => User, (user) => user.categories, { onDelete: 'CASCADE' })
  user!: User;

  @OneToMany(() => Card, (card) => card.category)
  cards!: Card[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
