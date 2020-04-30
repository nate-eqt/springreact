package com.example.springreact.payroll;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

/*
Loads the in-memory database so we have something to work with
 */
@Component
public class DatabaseLoader implements CommandLineRunner {
    private final EmployeeRepo repo;

    @Autowired
    public DatabaseLoader(EmployeeRepo repo){
        this.repo = repo;
    }

    @Override
    public void run(String... strings) throws Exception{
        this.repo.save(new Employee("Han","Solo","Smuggler"));
        this.repo.save(new Employee("Luke","Skywalker","Jedi"));
        this.repo.save(new Employee("Leia","Organa-Solo","General"));
        this.repo.save(new Employee("Kylo","Ren","Twat"));
        this.repo.save(new Employee("Finn","","Rando"));
        this.repo.save(new Employee("Poe","Dameron","Pilot"));
        this.repo.save(new Employee("Rey","","Jedi"));
    }

}
