package com.example.springreact.payroll;
import org.springframework.data.repository.Repository;
import org.springframework.data.rest.core.annotation.RepositoryRestResource;

@RepositoryRestResource(exported = false) //this is not to be made available for REST ops
public interface ManagerRepo extends Repository<Manager, Long> {

    Manager save(Manager manager);

    Manager findByName(String name);

}