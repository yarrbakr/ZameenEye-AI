import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from "typeorm"
import { Tenant } from "./tenant"
import { User } from "./user"

@Entity()
export class Land {
    @PrimaryGeneratedColumn("uuid")
    id!: string

    @ManyToOne(() => Tenant, { onDelete: "RESTRICT" })
    tenant!: Tenant

    @ManyToOne(() => User, { onDelete: "RESTRICT" })
    owner!: User

    @Column()
    label!: string

    @Column({
        type: "geometry",
        spatialFeatureType: "Polygon",
        srid: 4326,
    })
    geom!: string

    @CreateDateColumn()
    created_at!: Date
}