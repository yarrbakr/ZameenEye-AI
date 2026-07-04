import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from "typeorm"
import { Tenant } from "./tenant"

@Entity()
export class User {
    @PrimaryGeneratedColumn("uuid")
    id!: string

    @ManyToOne(() => Tenant, { onDelete: "RESTRICT" })
    tenant!: Tenant

    @Column({ unique: true })
    phone_number!: string

    @Column({ type: "enum", enum: ["agency_admin", "farmer"] })
    role!: "agency_admin" | "farmer"

    @Column()
    name!: string

    @CreateDateColumn()
    created_at!: Date
}