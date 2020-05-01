package com.example.springreact.components;

import com.example.springreact.payroll.Employee;
import com.example.springreact.payroll.EmployeeRepo;
import com.example.springreact.payroll.Manager;
import com.example.springreact.payroll.ManagerRepo;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/*
Loads the in-memory database so we have something to work with
 */
@Component
public class DatabaseLoader implements CommandLineRunner {
    private final EmployeeRepo repo;
    private final ManagerRepo managers;

    @Autowired
    public DatabaseLoader(EmployeeRepo repo, ManagerRepo managerRepo){
        this.repo = repo;
        this.managers = managerRepo;
    }

    @Override
    public void run(String... strings) throws Exception{
        Manager george = this.managers.save(new Manager("george", "password", "ROLE_MANAGER"));
        Manager mickey = this.managers.save(new Manager("mickey", "password","ROLE_MANAGER"));

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("george", "password",
                        AuthorityUtils.createAuthorityList("ROLE_MANAGER")));

        this.repo.save(new Employee("Han","Solo","Smuggler",george));
        this.repo.save(new Employee("Luke","Skywalker","Jedi",george));
        this.repo.save(new Employee("Leia","Organa-Solo","General",george));
        this.repo.save(new Employee("Darth","Vader","Sith Lord",george));

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("mickey", "password",
                        AuthorityUtils.createAuthorityList("ROLE_MANAGER")));

        this.repo.save(new Employee("Kylo","Ren","Dork",mickey));
        this.repo.save(new Employee("Finn","","Rando",mickey));
        this.repo.save(new Employee("Poe","Dameron","Pilot",mickey));
        this.repo.save(new Employee("Rey","","Jedi", mickey));

        SecurityContextHolder.clearContext();
    }

}
